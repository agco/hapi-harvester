'use strict'

const _ = require('lodash')
const routes = require('./routes')()
const adapterUtils = require('./utils/adapter')()
const routeUtils = require('./utils/route')()

exports.register = function (server, opts, next) {
    server.expose('version', require('../package.json').version);

    const adapter = opts.adapter;

    adapterUtils.checkValidAdapter(adapter);

    adapter.connect(() => {
        server.expose('adapter', adapter);
        next()
    });

    const get = function (schema) {
        routeUtils.createOptionsRoute(server, schema)
        adapter.processSchema(schema)
        return _.merge(routes.get(schema), {
            handler: (req, reply) => {
                routeUtils.parseComparators(req)
                reply(adapter.find(schema.type, req))
            }
        })
    }

    const getById = function (schema) {
        routeUtils.createOptionsRoute(server, schema)
        adapter.processSchema(schema)
        return _.merge(routes.getById(schema), {
            handler: (req, reply) => {
                reply(adapter.findById(schema.type, req))
            }
        })
    }

    const post = function (schema) {
        routeUtils.createOptionsRoute(server, schema)
        adapter.processSchema(schema)
        return _.merge(routes.post(schema), {
            handler: (req, reply) => {
                reply(adapter.create(schema.type, req)).code(201)
            }
        })
    }

    const patch = function (schema) {
        routeUtils.createOptionsRoute(server, schema)
        adapter.processSchema(schema)
        return _.merge(routes.patch(schema), {
            handler: (req, reply) => {
                reply(adapter.update(schema.type, req))
            }
        })
    }

    const del = function (schema) {
        routeUtils.createOptionsRoute(server, schema)
        adapter.processSchema(schema)
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

    server.ext('onPostStop', (server, next) => {
        adapter.disconnect(next)
    })


    server.ext('onPreResponse', (request, reply) => {
        const response = request.response
        if (response.isBoom) {
            response.output = response.output || {}
            response.output.headers = response.output.headers || {}
            response.output.headers['content-type'] = 'application/vnd.api+json';
            let error = {
                status: response.output.statusCode,
                title: response.output.payload.error,
                detail: response.output.payload.message,
                code: response.output.payload.code,
                meta: response.output.payload.meta
            }
            response.output.payload = {
                errors: [ error ]
            }
            reply(response)
        } else {
            reply.continue()
        }
    })
}

exports.register.attributes = {
    pkg: require('../package.json')
}

exports.getAdapter = adapterUtils.getStandardAdapter;
