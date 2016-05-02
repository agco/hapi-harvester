'use strict'

const _ = require('lodash')
const routes = require('../routes')()

module.exports = function () {

    const createRelationshipsRoutesRead = function (adapter, schema) {

        const getById = function (relationshipName) {
            return _.merge(routes.getByIdRelationships(schema, relationshipName), {
                handler: (req, reply) => {
                    reply({data: adapter.findById(schema.type, req)})
                }
            })
        }

        return mapRelationshipsToRoutes(schema, [getById])
    }

    const createRelationshipsRoutesWrite = function (adapter, schema) {

        const patch = function (relationshipName) {
            return _.merge(routes.patchByIdRelationships(schema, relationshipName), {
                handler: function (req, reply) {
                    reply(adapter.findById(schema.type, req.params.id).then(function (result) {
                        result.relationships[relationshipName].data = req.payload.data
                        return adapter.update(schema.type, result.id, result)
                    }).then(function () {
                        return {}
                    })).code(204)
                }
            })
        }

        const post = function (relationshipName) {
            return _.merge(routes.postByIdRelationships(schema, relationshipName), {
                handler: function (req, reply) {
                    if (!_.isArray(schema.relationships[relationshipName].data)) {
                        reply().code(403)
                        return
                    }
                    reply(adapter.findById(schema.type, req.params.id).then(function (result) {
                        result.relationships[relationshipName].data = result.relationships[relationshipName].data || []
                        result.relationships[relationshipName].data = _.union(result.relationships[relationshipName].data, req.payload.data)
                        result.relationships[relationshipName].data = _.uniq(result.relationships[relationshipName].data, 'id')
                        return adapter.update(schema.type, result.id, result)
                    }).then(function () {
                        return {}
                    })).code(204)
                }
            })
        }

        const deleteItem = function (relationshipName) {
            return _.merge(routes.deleteByIdRelationships(schema, relationshipName), {
                handler: function (req, reply) {
                    reply(adapter.findById(schema.type, req.params.id).then(function (result) {
                        result.relationships[relationshipName].data = null
                        return adapter.update(schema.type, result.id, result)
                    }).then(function () {
                        return {}
                    })).code(204)
                }
            })
        }

        return mapRelationshipsToRoutes(schema, [patch, post, deleteItem])

    }

    function mapRelationshipsToRoutes(schema, routeFactories) {
        return _.chain(schema.relationships)
            .map((relationshipSpec, relationshipName) => {
                return _.map(routeFactories, function (routeFactory) {
                    return routeFactory(relationshipName)
                })
            })
            .flatten()
            .value();
    }

    const parseComparators = function (req) {
        const supportedComparators = ['lt', 'lte', 'gt', 'gte']

        function doParse(key, filter) {
            const split = filter.split('=')
            if (split.length > 1 && _.contains(supportedComparators, split[0])) {
                req.query.filter[key] = req.query.filter[key] || {}
                req.query.filter[key][split[0]] = split[1]
                return true
            }
            return false
        }

        req.query.filter && _.each(req.query.filter, (filter, key) => {
            req.query.filter[key] = {}
            if (_.isArray(filter)) {
                _.forEach(filter, function (item) {
                    doParse(key, item)
                });
                if (_.isEmpty(req.query.filter[key])) {
                    req.query.filter[key] = {$in: filter}
                }
            } else {
                if (!doParse(key, filter)) {
                    req.query.filter[key] = filter
                }
            }
        })

        return req
    }

    return {createRelationshipsRoutesRead, createRelationshipsRoutesWrite, parseComparators}
}
