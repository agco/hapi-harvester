'use strict'

const _ = require('lodash')
const routes = require('./routes')()

exports.register = function (server, options, next) {
	console.log('PLUGIN STARTED')
	server.expose('version', require('../package.json').version);
	
	let get = function (schema) {
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
		delete: del
    })
    
    next()
}

exports.register.attributes = {
	pkg: require('../package.json')
}
