'use strict'

const _ = require('lodash')
const routes = require('../routes')()

module.exports = function() {
    const createOptionsRoute = function(server, schema) {
        const tables = _.map(server.table()[0].table)
        
        //see if the options method already exists, if so, don't duplicate it
        if (_.find(tables, {path : '/' + schema.type, method: 'options'})) return;
        
        server.route(_.merge(routes.options(schema), {
            handler: (req, reply) => {
                const tables = _.map(req.server.table()[0].table, (table) => {
                    return _.pick(table, 'path', 'method')
                })
                
                const pathVerbs = _.chain(tables)
                .filter((table) => {
                    return table.path.replace('/{id}', '') === req.path 
                })
                .pluck('method')
                .map((verb) => { return verb.toUpperCase() })
                .value();
                
                reply().header('Allow', pathVerbs.join(','))
            }
        }))
    }

    const createRelationshipsRoutes = function (server, schema) {
        const adapter = server.plugins.harvester.adapter
        server.route({
            method: 'PATCH',
            path: `/${schema.type}/{id}/relationships/{relationship}`,
            handler: function (req, reply) {
                adapter.findById(schema.type, req).then(function (result) {
                    const relationshipName = req.params.relationship
                    result.data.relationships[relationshipName] = req.payload.data
                    return adapter.update(schema.type, {payload: result, params: {id: result.data.id}, query: {}})
                }).then(function () {
                    reply().code(204)
                }).catch(function (error) {
                    console.error(error && error.stack || error)
                    reply().code(500)
                })

            }
        })
        server.route({
            method: 'POST',
            path: `/${schema.type}/{id}/relationships/{relationship}`,
            handler: function (req, reply) {
                const relationshipName = req.params.relationship
                if (!_.isArray(schema.relationships[relationshipName])) {
                    reply().code(403)
                    return
                }
                adapter.findById(schema.type, req).then(function (result) {
                    result.data.relationships[relationshipName] = result.data.relationships[relationshipName] || []
                    result.data.relationships[relationshipName] = _.union(result.data.relationships[relationshipName], req.payload.data)
                    result.data.relationships[relationshipName] = _.uniq(result.data.relationships[relationshipName], 'id')
                    return adapter.update(schema.type, {payload: result, params: {id: result.data.id}, query: {}})
                }).then(function () {
                    reply().code(204)
                }).catch(function (error) {
                    console.error(error && error.stack || error)
                    reply().code(500)
                })

            }
        })
        server.route({
            method: 'DELETE',
            path: `/${schema.type}/{id}/relationships/{relationship}`,
            handler: function (req, reply) {
                adapter.findById(schema.type, req).then(function (result) {
                    const relationshipName = req.params.relationship
                    result.data.relationships[relationshipName] = null
                    return adapter.update(schema.type, {payload: result, params: {id: result.data.id}, query: {}})
                }).then(function () {
                    reply().code(204)
                }).catch(function (error) {
                    console.error(error && error.stack || error)
                    reply().code(500)
                })

            }
        })
    }
    
    const parseComparators = function(req) {
        const supportedComparators = ['lt', 'lte', 'gt', 'gte']
        
        req.query.filter && _.each(req.query.filter, (filter, key) => {
            const split = filter.split('=')
            
            if (split.length > 1 &&  _.contains(supportedComparators, split[0])) {
                req.query.filter[key] = {[split[0]] : split[1]}
            }
        })
        
        return req
    }

    return {createOptionsRoute, createRelationshipsRoutes, parseComparators}
}
