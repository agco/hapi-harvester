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

    const appendLinkedResources = includes(adapter, schemas).appendLinkedResources;

    const onRouteRegister = function(schema) {
        routeUtils.createOptionsRoute(server, schema);
        adapter.processSchema(schema);
        schemas[schema.type] = schema;
    }

    const get = function (schema) {
        onRouteRegister(schema);
        return _.merge(routes.get(schema), {
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
        return _.merge(routes.getById(schema), {
            handler: (req, reply) => {
                if (req.params.relationship) {
                    adapter.findById(schema.type, req).then(function (result) {
                        const relationshipName = req.params.relationship.split('/')[1]
                        if (result.data.relationships && result.data.relationships[relationshipName]) {
                            let relationship = result.data.relationships[relationshipName]
                            if (_.isArray(relationship)) {
                                let ids = relationship.map(function (item) {
                                    return item.id
                                }).join(',')
                                if (_.isEmpty(ids)) {
                                    reply({data: []})
                                } else {
                                    let type = schema.relationships[relationshipName][0].type
                                    server.inject({method: 'get', url: '/' + type + '?filter[id]=' + ids}, function (res) {
                                        reply(res.result).code(res.statusCode)
                                    })
                                }
                            } else {
                                server.inject({method: 'get', url: '/' + relationship.type + '/' + relationship.id}, function (res) {
                                    reply(res.result).code(res.statusCode)
                                })
                            }
                        } else {
                            reply({data: null})
                        }
                    })
                } else {
                    reply(adapter.findById(schema.type, req))
                }
            }
        })
    }
    
    const post = function (schema) {
        onRouteRegister(schema);
        return _.merge(routes.post(schema), {
            handler: (req, reply) => {
                reply(adapter.create(schema.type, req)).code(201)
            }
        })
    }
    
    const patch = function (schema) {
        onRouteRegister(schema);
        return _.merge(routes.patch(schema), {
            handler: (req, reply) => {
                reply(adapter.update(schema.type, req))
            }
        })
    }
    
    const del = function (schema) {
        onRouteRegister(schema);
        return _.merge(routes.delete(schema), {
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

    server.ext('onPreResponse', function (req, reply) {
            if (req.query.include) {
                Promise.resolve().then(function () {
                    var type = req.path.match(/^\/([^/]+).*/)[1];
                    return appendLinkedResources(req.response.source, type, req.query.include.split(','));
                }).then(function (body) {
                    reply(body);
                }).catch(function (error) {
                    console.log(error.stack);
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
