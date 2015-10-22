'use strict'

const _ = require('lodash')
const routes = require('./routes')()
const adapterUtils = require('./utils/adapter')()

exports.register = function (server, opts, next) {
    server.expose('version', require('../package.json').version);
    
    const adapter = opts.adapter;
    
    adapterUtils.checkValidAdapter(adapter);
    
    adapter.connect(() => {
        server.expose('adapter', adapter);
        next()
    });
    
    const createOptionsRoute = function(schema) {
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
    
    const get = function (schema) {
        createOptionsRoute(schema)
        adapter.processSchema(schema)
        return _.merge(routes.get(schema), {
            handler: (req, reply) => {
                reply(adapter.find(schema.type, req))
            }
        })
    }
    
    const getById = function (schema) {
        createOptionsRoute(schema)
        adapter.processSchema(schema)
        return _.merge(routes.getById(schema), {
            handler: (req, reply) => {
                reply(adapter.findById(schema.type, req))
            }
        })
    }
    
    const post = function (schema) {
        createOptionsRoute(schema)
        adapter.processSchema(schema)
        return _.merge(routes.post(schema), {
            handler: (req, reply) => {
                reply(adapter.create(schema.type, req)).code(201)
            }
        })
    }
    
    const patch = function (schema) {
        createOptionsRoute(schema)
        adapter.processSchema(schema)
        return _.merge(routes.patch(schema), {
            handler: (req, reply) => {
                reply(adapter.update(schema.type, req))
            }
        })
    }
    
    const del = function (schema) {
        createOptionsRoute(schema)
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
}

exports.register.attributes = {
    pkg: require('../package.json')
}

exports.getAdapter = adapterUtils.getStandardAdapter;
