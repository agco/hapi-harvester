'use strict'

const _ = require('lodash')
const Hoek = require('hoek')
const Promise = require('bluebird')
const Rx = require('rx')
const RxNode = require('rx-node')
const mongo = require('mongoose/node_modules/mongodb')
const mongoose = require('mongoose')
const Boom = require('boom')

const connection = require('../connection')

module.exports = function (mongodbOplogUrl, options) {

    options = options || {}

    Hoek.assert(mongodbOplogUrl, 'mongodbOplogUrl missing')

    const db = mongoose.createConnection()

    const connect = function () {
        return connection.connect(db, mongodbOplogUrl, _.merge({server: {maxPoolSize: 100}}, options))
    }

    const disconnect = function () {
        return connection.disconnect(db)
    }

    const streamChanges = function (resources, verbs, lastEventId) {

        return Promise.resolve()
            .then(()=> {
                if (lastEventId) {
                    const tsSplit = _.map(lastEventId.split('_'), function (item) {
                        return parseInt(item, 10)
                    })
                    const isValidTS = _.all(tsSplit, function (ts) {
                        return !isNaN(ts)
                    })
                    if (!isValidTS) {
                        return Boom.badRequest(`the last-event-id provided is not valid`, lastEventId)
                    }
                }

                const regex = new RegExp('.*\\.(' + resources.join('|') + ')', 'i')

                return getQuery(verbs, lastEventId, regex)
                    .then(function (query) {

                        const options = {
                            tailable: true,
                            awaitData: true,
                            oplogReplay: true,
                            numberOfRetries: Number.MAX_VALUE
                        }

                        function DisposableOplogStream(stream) {
                            const d = Rx.Disposable.create(() => {
                                stream.destroy()

                            })
                            d.stream = stream
                            return d
                        }

                        const oplogCollection = db.collection('oplog.rs')
                        const stream = oplogCollection.find(query, options).stream()

                        return Rx.Observable
                            .using(
                                () => {
                                    return new DisposableOplogStream(stream)
                                },
                                (d) => {
                                    return RxNode.fromStream(d.stream)
                                        .map((chunk)=> {
                                            return {
                                                id: chunk.ts.getHighBits() + '_' + chunk.ts.getLowBits(),
                                                event: getEventName(resources[0], chunk),
                                                data: getData(chunk)
                                            }
                                        })
                                }
                            )

                    })
            })
    }

    function getQuery(verbs, lastEventId, ns) {

        const ops = verbs.map(function (verb) {
            return {
                'post': 'i',
                'put': 'u',
                'delete': 'd'
            }[verb]
        })

        const query = {
            ns: ns,
            op: new RegExp('(' + ops.join('|') + ')', 'i')
        }

        return new Promise(function (resolve, reject) {
            if (lastEventId) {
                const tsSplit = _.map(lastEventId.split('_'), function (item) {
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

    function getData(chunk) {

        switch (chunk.op) {
            case 'i' :
                return deserialize(chunk.o)
            case 'u' :
                return chunk.o.$set
            default :
                return {}
        }

    }

    function deserialize(mongoEntity) {
        delete mongoEntity.__v
        mongoEntity.id = mongoEntity._id
        delete mongoEntity._id
        return mongoEntity
    }

    function getEventName(routeNames, chunk) {
        return routeNames + '_' + chunk.op
    }

    return {
        connect,
        disconnect,
        streamChanges
    }

}




