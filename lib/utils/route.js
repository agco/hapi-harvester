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

    const isRouteRegistered = function (server, route) {
        return _.any(server.table(), function (item) {
            return _.any(item.table, function (registeredRoute) {
                return registeredRoute.path.toLowerCase() === route.path.toLowerCase() && registeredRoute.method.toLowerCase() === route.method.toLowerCase();
            });
        });
    }

    const createRelationshipsRoutesRead = function (server, schema) {
        const getById = function (relationshipName) {
            return _.merge(routes.getByIdRelationships(schema, relationshipName), {config: schema.config}, {
                handler: (req, reply) => {
                    reply({data: adapter.findById(schema.type, req)})
                }
            })
        }
        _.forEach(schema.relationships, function (relationshipSpec, relationshipName) {
            _.forEach([getById], function (routeFactory) {
                const route = routeFactory(relationshipName);
                if (!isRouteRegistered(server, route)) {
                    server.route(route)
                }
            })
        });
    }

    const createRelationshipsRoutesWrite = function (server, schema) {
        const adapter = server.plugins['hapi-harvester'].adapter

        const patch = function (relationshipName) {
            return _.merge(routes.patchByIdRelationships(schema, relationshipName), {config: schema.config}, {
                handler: function (req, reply) {
                    reply(adapter.findById(schema.type, req.params.id).then(function (result) {
                        result.relationships[relationshipName] = req.payload.data
                        return adapter.update(schema.type, result.id, result)
                    }).then(function () {
                        return {}
                    })).code(204)

                }
            })
        }

        const post = function (relationshipName) {
            return _.merge(routes.postByIdRelationships(schema, relationshipName), {config: schema.config}, {
                handler: function (req, reply) {
                    if (!_.isArray(schema.relationships[relationshipName])) {
                        reply().code(403)
                        return
                    }
                    reply(adapter.findById(schema.type, req.params.id).then(function (result) {
                        result.relationships[relationshipName] = result.relationships[relationshipName] || []
                        result.relationships[relationshipName] = _.union(result.relationships[relationshipName], req.payload.data)
                        result.relationships[relationshipName] = _.uniq(result.relationships[relationshipName], 'id')
                        return adapter.update(schema.type, result.id, result)
                    }).then(function () {
                        return {}
                    })).code(204)
                }
            })
        }

        const deleteItem = function (relationshipName) {
            return _.merge(routes.deleteByIdRelationships(schema, relationshipName), {config: schema.config}, {
                handler: function (req, reply) {
                    reply(adapter.findById(schema.type, req.params.id).then(function (result) {
                        result.relationships[relationshipName] = null
                        return adapter.update(schema.type, result.id, result)
                    }).then(function () {
                        return {}
                    })).code(204)
                }
            })
        }

        _.forEach(schema.relationships, function (relationshipSpec, relationshipName) {
            _.forEach([patch, post, deleteItem], function (routeFactory) {
                const route = routeFactory(relationshipName);
                if (!isRouteRegistered(server, route)) {
                    server.route(route)
                }
            })
        });

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

    return {createOptionsRoute, createRelationshipsRoutesRead, createRelationshipsRoutesWrite, parseComparators}
}
