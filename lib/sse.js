'use strict'

const _ = require('lodash')
const mongoose = require('mongoose')
const Boom = require('boom')
const Rx = require('rx')


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

function sse(config) {
    config = _.extend({}, config);
    //only listen to post events if the verb is not specified
    config.verbs = config.verbs || ['post', 'put', 'delete']

    //wraps it up in an array of single item, so that it fits the current logic without too many conditions
    config.singleResourceName = config.singleResourceName && [config.singleResourceName]

    return function (req, reply) {
        handler(config, req, reply)
    }
}

function getRouteNames(req, config) {

    if (config.singleResourceName) {
        return config.singleResourceName
    } else {
        return req.query.resources ? req.query.resources.split(',') : []
    }
}

function handler(config, req, reply) {

    Promise.resolve()
        .then(() => {

            const routeNames = getRouteNames(req, config)

            if (routeNames.length === 0) {
                return reply(Boom.badRequest('You have not specified any resources, please do so by providing "resource?foo,bar" as query',
                    'Requested changes on missing resource'))
            }

            if (!allResourcesExist(config, routeNames)) {
                return reply(Boom.badRequest('The follow resources don\'t exist ' + getMissingResources(config, routeNames).join(','), 'Requested changes on missing resource'))
            }

            const adapterSSE = config.context.plugins['hapi-harvester'].adapterSSE

            return adapterSSE
                .streamChanges(routeNames, config.verbs, req.headers['last-event-id'])
                .then((changesStream)=> {
                    if (changesStream.isBoom) {
                        reply(changesStream)
                    } else {
                        processChanges(changesStream)
                    }
                })

            function processChanges(changesStream) {

                const subject = new Rx.Subject()

                let ping = 0
                const tickerStream = Rx.Observable
                    .interval(5000)
                    .map(() => {
                        return {event: 'ticker', id: ping, data: ping++}
                    })
                    .subscribe(subject)

                const eventStream = changesStream
                    .filter((event) => {

                        const filters = getFilters(req)
                        if (filters.length === 0) return true

                        var passedFilters = _.reduce(filters, function (obj, filter) {
                            return _.filter([event.data], _.matches(filter))
                        }, true);
                        return passedFilters.length > 0

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

            }

        })
        .catch((err) => {
            console.error(err && err.stack || err)
            reply.continue(err)
        })


}


function allResourcesExist(config, resourceNames) {
    return getMissingResources(config, resourceNames).length === 0
}

function getMissingResources(config, resourceNames) {
    var harvesterResourceNames = config.singleResourceName || _.keys(config.context.plugins['hapi-harvester'].schemas)
    return _.difference(resourceNames, harvesterResourceNames)
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


module.exports = sse
