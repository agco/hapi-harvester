'use strict'

const _ = require('lodash')
const routes = require('./routes')()

exports.register = function (server, opts, next) {
	console.log('PLUGIN STARTED')
	server.expose('version', require('../package.json').version);
    
	let options = function (schema) {
		return _.merge(routes.options(schema), {
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
        })
    }
    
	let get = function (schema) {
        server.route(options(schema))
		return _.merge(routes.get(schema), {
            handler: (req, reply) => {
                reply({foo: 'bar'})
            }
        })
    }
	
	let post = function (schema) {
		return _.merge(routes.post(schema), {
            handler: (req, reply) => {
                reply({foo: 'bar'})
            }
        })
    }
    
    let put = function (schema) {
		return _.merge(routes.put(schema), {
            handler: (req, reply) => {
                reply({foo: 'bar'})
            }
        })
    }
	
	let patch = function (schema) {
		return _.merge(routes.patch(schema), {
            handler: (req, reply) => {
                reply({foo: 'bar'})
            }
        })
    }
	
	let del = function (schema) {
		return _.merge(routes.delete(schema), {
            handler: (req, reply) => {
                reply({foo: 'bar'})
            }
        })
    }
	
	server.expose('routes', {
        get: get,
        post: post,
		put: put,
        patch: patch,
		delete: del,
        options: options
    })
    
    next()
}

exports.register.attributes = {
	pkg: require('../package.json')
}
