'use strict'

const _ = require('lodash')
const mongoose = require('mongoose')
const Promise = require('bluebird')
const Boom = require('boom')
const Rx = require('rx')
const RxNode = require('rx-node')
const mongo = require('mongoose/node_modules/mongodb');
const MongoClient = mongo.MongoClient;

/*
 Usage:
 ======================================
 When setting up Multi SSE (ie: SSE for multiple resources), you just need to pass in Harvester context as such:

 this.multiSSE = sse({
 context: server
 })

 You can then point an EventReader to listen from "{base_url}/changes/streaming?resouces=foo,bar,baz".

 When setting up SSE for a single route, you will need to pass the resource name:

 this.singleSSE = sse({
 singleResourceName: 'foo'
 })

 You can then point an EventReader to listen from "{base_url}/foo/changes/streaming".

 Verbs:
 ======================================
 You can also pass a "verbs" option to this module. If none is passed, SSE will only listen to "insert" events from uplog.
 Values you can pass are "post", "put" and "delete" which in turn currespond to oplog ops "i", "u" and "d".

 this.singleSSE = sse({
 context: server,
 singleResourceName: 'foo',
 verbs: ['post', 'put', 'delete']
 })
 */

const dbOpenDfd = Promise.defer()

const connect = (oplogConnectionString) => {
    MongoClient.connect(oplogConnectionString, {
        db: { bufferMaxEntries: 0 },
        server: {
            poolSize: 100,
            auto_reconnect: true,
            socketOptions: {
                keepAlive: 1,
                connectTimeoutMS: 30000
            }
        }
    }, (err, db) => {
        if (err) dbOpenDfd.reject(err)
        else {
            db.on('error', (e) => {
                console.error(e)
            })
            dbOpenDfd.resolve(db)
        }
    })
}

const connectOnce = _.memoize(connect)

function sse(config) {
    config = _.extend({}, config);
    //only listen to post events if the verb is not specified
    config.verbs = config.verbs || ['post', 'put', 'delete']

    //wraps it up in an array of single item, so that it fits the current logic without too many conditions
    config.singleResourceName = config.singleResourceName && [config.singleResourceName]

    config.dbOpen = dbOpenDfd.promise
    connectOnce(config.context.plugins['hapi-harvester'].adapter.options.oplogConnectionString)

    return function (req, reply) {
        handler(config, req, reply)
    }
}

function requestValidationMiddleware(config, req) {
    let routeNames = req.query.resources ? req.query.resources.split(',') : []

    if (config.singleResourceName) {
        routeNames = config.singleResourceName
    }

    if (routeNames.length === 0) {
        throw Boom.badRequest('You have not specified any resources, please do so by providing "resource?foo,bar" as query',
            'Requested changes on missing resource'
        )
    }

    if (!allResourcesExist(config, routeNames)) {
        throw Boom.badRequest('The follow resources don\'t exist ' + getMissingResources(config, routeNames).join(','), 'Requested changes on missing resource')
    }

    if (req.headers['last-event-id']) {
        var tsSplit = _.map(req.headers['last-event-id'].split('_'), function (item) {
            return parseInt(item, 10)
        })

        const isValidTS = _.all(tsSplit, function (ts) {
            return !isNaN(ts)
        })

        if (!isValidTS) {
            throw Boom.badRequest('Could not parse the time stamp provided', 'Invalid Timestamp')
        }
    }
}

function handler(config, req, reply) {

    requestValidationMiddleware(config, req)

    let routeNames = req.query.resources ? req.query.resources.split(',') : []

    if (config.singleResourceName) {
        routeNames = config.singleResourceName
    }

    var lowercasedRouteHash = _.reduce(routeNames, function (accumulator, route) {
        accumulator[route.toLowerCase()] = route;
        return accumulator;
    }, {});
    config.dbOpen.then((db)=> {

        var regex = new RegExp('.*\\.(' + routeNames.join('|') + ')', 'i')

        getQuery(config, db, req, regex)
            .then(function (query) {

                const options = {
                    tailable: true,
                    awaitData: true,
                    oplogReplay: true,
                    numberOfRetries: Number.MAX_VALUE
                }

                function DisposableOplogStream(stream) {
                    var d = Rx.Disposable.create(() => {
                        stream.destroy()

                    })
                    d.stream = stream
                    return d
                }

                const oplogCollection = db.collection('oplog.rs')
                const stream = oplogCollection.find(query, options).stream()

                const subject = new Rx.Subject();

                var eventStream = Rx.Observable
                    .using(
                        () => {
                            return new DisposableOplogStream(stream)
                        },
                        (d) => {
                            return RxNode.fromStream(d.stream)
                                .map((chunk)=> {
                                    return {
                                        id: chunk.ts.getHighBits() + '_' + chunk.ts.getLowBits(),
                                        event: getEventName(lowercasedRouteHash, chunk),
                                        data: getData(chunk)
                                    }
                                })
                                .filter((event) => {
                                    var filters = getFilters(req)
                                    var passedFilter = _.reduce(filters, function (obj, filter) {
                                        return _.filter([event.data], _.matches(filter))
                                    }, true)

                                    //if we have filters, make sure they are passed
                                    return (passedFilter.length > 0 || filters.length === 0)
                                });
                        }
                    ).subscribe(subject)


                let ping = 0
                const tickerStream = Rx.Observable
                    .interval(5000)
                    .map(() => {
                        return {event: 'ticker', id: ping, data: ping++}
                    })
                    .subscribe(subject)

                reply.event('\n')

                const eventReplyStream = subject
                    .subscribe(
                        (event) => {
                            reply.event(event)
                        },
                        (err) => {
                            console.error(err)
                            reply.event(null)
                        })

                // this is triggered on req.abort()
                req.raw.req.on('close', function () {
                    tickerStream.dispose()
                    eventStream.dispose()
                    eventReplyStream.dispose()
                })


            })
            .catch(function (err) {
                console.error(err && err.stack || err)
                reply.continue(err)
            })

    })

}


function allResourcesExist(config, resourceNames) {
    return getMissingResources(config, resourceNames).length === 0
}

function getMissingResources(config, resourceNames) {
    var harvesterResourceNames = config.singleResourceName || _.keys(config.context.plugins['hapi-harvester'].schemas)
    return _.difference(resourceNames, harvesterResourceNames)
}

function getQuery(config, db, req, ns) {
    var lastEventId = req.headers['last-event-id']

    var verbs = config.verbs.map(function (verb) {
        return {
            'post': 'i',
            'put': 'u',
            'delete': 'd'
        }[verb]
    })

    var query = {
        ns: ns,
        op: new RegExp('(' + verbs.join('|') + ')', 'i')
    }

    return new Promise(function (resolve, reject) {
        if (req.headers['last-event-id']) {
            var tsSplit = _.map(lastEventId.split('_'), function (item) {
                return parseInt(item, 10)
            })

            query.ts = {
                $gt: new mongo.Timestamp(tsSplit[1], tsSplit[0])
            }

            return resolve(query)
        }

        const oplogCollection = db.collection('oplog.rs')
        oplogCollection.find({op: query.op}, {sort: {$natural: -1}, limit: 1}).toArray(function (err, items) {
            if (err) {
                return reject(err)
            }
            if (items.length === 0) {
                query.ts = {
                    $gt: new mongo.Timestamp()
                }

            } else {
                query.ts = {
                    $gt: items[0].ts
                }
            }
            resolve(query)
        })
    })
}


function getFilters(req) {

    return _.chain(req.query)
        .map(function (item, key) {
            if (!_.contains(['limit', 'sort', 'offset', 'resources'], key)) {
                var filter = {}
                filter[key] = item
                return filter
            }
        })
        .filter(function (item) {
            return !!item
        })
        //converts {'foo.bar' : 'foobar'} to {foo : { bar : 'foobar' }}
        .map(function (item) {
            var keys = _.keys(item)[0].split('.')
            return _.reduce(keys, function (obj, key, index) {

                var value = (index === keys.length - 1 || keys.length === 1) ? _.values(item)[0] : {}

                if (index === 0) {
                    obj[key] = (keys.length > 1) ? {} : value
                } else {
                    obj[keys[index - 1]][key] = value
                }
                return obj
            }, {})
        })
        .value()

}

function deserialize(mongoEntity) {
    delete mongoEntity.__v
    mongoEntity.id = mongoEntity._id
    delete mongoEntity._id
    return mongoEntity
}

function getData(chunk) {
    var data

    switch (chunk.op) {
        case 'i' :
            data = deserialize(chunk.o)
            break
        case 'u' :
            data = chunk.o.$set
            if (!data.id && chunk.o2 && chunk.o2._id) {
                data.id = chunk.o2._id
            }
            break
        default :
            data = {id:chunk.o._id}
    }

    return data
}

function getEventName(lowercasedRouteHash, chunk) {
    var type = chunk.o.type;
    var namespace = chunk.ns.split('.')[1];
    if (!type) {
        type = lowercasedRouteHash[namespace] || namespace;
    }
    return type + '_' + chunk.op;
}

module.exports = sse
