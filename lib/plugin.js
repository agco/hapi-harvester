'use strict'

const _ = require('lodash')
const routes = require('./routes')()
const adapterUtils = require('./utils/adapter')()

exports.register = function (server, opts, next) {
    server.expose('version', require('../package.json').version);
    
    let adapter = opts.adapter;
    
    adapterUtils.checkValidAdapter(adapter);
    
    adapter.connect(() => {
        next()
    });
    
    let createOptionsRoute = function(schema) {
        let tables = _.map(server.table()[0].table)
        
        //see if the options method already exists, if so, don't duplicate it
        if (_.find(tables, {path : '/' + schema.type, method: 'options'})) return;
        
        server.route(_.merge(routes.options(schema), {
            handler: (req, reply) => {
                let tables = _.map(req.server.table()[0].table, (table) => {
                    return _.pick(table, 'path', 'method')
                })
                
                let pathVerbs = _.chain(tables)
                .filter((table) => { return table.path === req.path })
                .pluck('method')
                .map((verb) => { return verb.toUpperCase() })
                .value();
                
                reply().header('Allow', pathVerbs.join(','))
            }
        }))
    }
    
    let get = function (schema) {
        createOptionsRoute(schema)
        adapter.processSchema(schema)
        return _.merge(routes.get(schema), {
            handler: (req, reply) => {
                reply(adapter.find(schema.type, req))
            }
        })
    }
    
    let getById = function (schema) {
        createOptionsRoute(schema)
        adapter.processSchema(schema)
        return _.merge(routes.get(schema), {
            handler: (req, reply) => {
                reply(adapter.findById(schema.type, req))
            }
        })
    }
    
    let post = function (schema) {
        createOptionsRoute(schema)
        adapter.processSchema(schema)
        return _.merge(routes.post(schema), {
            handler: (req, reply) => {
                reply(adapter.create(schema.type, req)).code(201)
            }
        })
    }
    
    let put = function (schema) {
        createOptionsRoute(schema)
        adapter.processSchema(schema)
        return _.merge(routes.put(schema), {
            handler: (req, reply) => {
                reply(adapter.update(schema.type, req))
            }
        })
    }
    
    let patch = function (schema) {
        createOptionsRoute(schema)
        adapter.processSchema(schema)
        return _.merge(routes.patch(schema), {
            handler: (req, reply) => {
                reply(adapter.update(schema.type, req))
            }
        })
    }
    
    let del = function (schema) {
        createOptionsRoute(schema)
        adapter.processSchema(schema)
        return _.merge(routes.delete(schema), {
            handler: (req, reply) => {
                reply(adapter.delete(schema.type, req))
            }
        })
    }
    
    server.expose('routes', {
        get: get,
        getById: getById,
        post: post,
        put: put,
        patch: patch,
        delete: del
    })
}

exports.register.attributes = {
    pkg: require('../package.json')
}

exports.getAdapter = adapterUtils.getStandardAdapter;
