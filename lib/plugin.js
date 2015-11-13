'use strict'

const _ = require('lodash')
const routes = require('./routes')()
const adapterUtils = require('./utils/adapter')()
const routeUtils = require('./utils/route')()
const includes = require('./includes');

exports.register = function (server, opts, next) {
    server.expose('version', require('../package.json').version);

    const adapter = opts.adapter;
    const schemas = {};

    adapterUtils.checkValidAdapter(adapter);

    adapter.connect(() => {
        server.expose('adapter', adapter);
        next()
    });

    const appendLinkedResources = includes(server, adapter, schemas).appendLinkedResources;

    const onRouteRegister = function(schema) {
        routeUtils.createOptionsRoute(server, schema);
        adapter.processSchema(schema);
        schemas[schema.type] = schema;
    }

    const get = function (schema) {
        onRouteRegister(schema);
        return _.merge(routes.get(schema), {config: schema.config}, {
            handler: (req, reply) => {
                routeUtils.parseComparators(req)
                /*Implicit type for sparse fields*/
                if (_.isString(req.query.fields)) {
                    let fields = req.query.fields;
                    req.query.fields = {};
                    req.query.fields[schema.type] = fields;
                }
                reply(adapter.find(schema.type, req))
            }
        })
    }

    const getById = function (schema) {
        onRouteRegister(schema)
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
                    reply().code(403);
                    return;
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
        return _.merge(routes.getById(schema), {config: schema.config}, {
            handler: (req, reply) => {
                reply(adapter.findById(schema.type, req))
            }
        })
    }

    const post = function (schema) {
        onRouteRegister(schema);
        return _.merge(routes.post(schema), {config: schema.config}, {
            handler: (req, reply) => {
                reply(adapter.create(schema.type, req)).code(201)
            }
        })
    }

    const patch = function (schema) {
        onRouteRegister(schema);
        return _.merge(routes.patch(schema), {config: schema.config}, {
            handler: (req, reply) => {
                reply(adapter.update(schema.type, req))
            }
        })
    }

    const del = function (schema) {
        onRouteRegister(schema);
        return _.merge(routes.delete(schema), {config: schema.config}, {
            handler: (req, reply) => {
                reply(adapter.delete(schema.type, req)).code(204)
            }
        })
    }

    server.expose('routes', {
        get: get,
        getById: getById,
        post: post,
        patch: patch,
        delete: del
    })

    server.expose('schemas', schemas);

    server.ext('onPostStop', (server, next) => {
        adapter.disconnect(next)
    })

    server.ext('onRequest', (request, reply) => {
        const match = request.url.pathname.match(/\/([^/]+)\/([^/]+)\/relationships\/([^/?#]+)/)
        if (request.method === 'get' && match) {
            const type = match[1];
            const parentId = match[2];
            const relationshipName = match[3];
            const url = '/' + type + '/' + parentId;
            server.inject({method: 'get', url: url, headers: request.hreaders}, function (res) {
                if (res.statusCode !== 200) {
                    reply(res.result).code(res.statusCode);
                    return
                }
                let result = res.result;
                if (result.data.relationships && result.data.relationships[relationshipName]) {
                    let relationship = result.data.relationships[relationshipName]
                    if (_.isArray(relationship)) {
                        let ids = relationship.map(function (item) {
                            return item.id
                        }).join(',')
                        if (_.isEmpty(ids)) {
                            reply({data: []})
                        } else {
                            let relationshipType = schemas[type].relationships[relationshipName][0].type
                            request.setUrl('/' + relationshipType + '?filter[id]=' + ids)
                            reply.continue();
                        }
                    } else {
                        request.setUrl('/' + relationship.type + '/' + relationship.id)
                        reply.continue();
                    }
                } else {
                    reply({data: null})
                }
            });
        } else {
            reply.continue();
        }
    })

    server.ext('onPreHandler', function (request, reply) {
        var routeSettingsForHarvester = request.route.settings.plugins.harvester
        if (routeSettingsForHarvester) {
            const before = routeSettingsForHarvester.before
            if (before) {
                before(request, reply)
                return;
            }
        }
        reply.continue()
    })

    server.ext('onPreResponse', (request, reply) => {
        function globallySetContentTypeJsonApi(request) {
            request.response = request.response || {}
            request.response.output = request.response.output || {}
            request.response.output.headers = request.response.output.headers || {}
            request.response.output.headers['content-type'] = 'application/vnd.api+json'
        }

        function createJsonApiError(output) {
            let error = {}
            if (!output.statusCode) {
                return {
                    errors: [ {
                        status: 500,
                        title: 'Internal Server Error'
                    }]
                }
            }
            if (output.statusCode) error.status = output.statusCode
            if (output.payload.error) error.title = output.payload.error
            if (output.payload.detail) error.detail = output.payload.detail
            if (output.payload.code) error.code = output.payload.code
            if (output.payload.meta) error.meta = output.payload.meta
            return { errors: [ error ] }
        }

        globallySetContentTypeJsonApi(request)
        const response = request.response
        if (response.isBoom) {
            response.output.payload = createJsonApiError(response.output)
            reply(response)
        } else if (request.query.include) {
            Promise.resolve().then(function () {
                var type = request.path.match(/^\/([^/]+).*/)[1];
                if (request.response.source) {
                    return appendLinkedResources(request, request.response.source, type, request.query.include.split(','), request.query.fields).then(reply);
                } else {
                    reply.continue();
                }
            }).catch(function (error) {
                console.error(error && error.stack || error);
                reply().code(500);
            });
        } else {
            reply.continue();
        }
    });

}

exports.register.attributes = {
    pkg: require('../package.json')
}

exports.getAdapter = adapterUtils.getStandardAdapter;
