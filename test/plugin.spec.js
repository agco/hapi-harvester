'use strict'

const hh = require('../')
const Joi = require('joi')
const Promise = require('bluebird')

let server, buildServer, destroyServer;

const schema = {
	type: 'brands',
	attributes: {
		code: Joi.string().min(2).max(10),
		description: Joi.string()
	}
};

describe('Plugin', function() {
	beforeEach(function(done) {
		buildServer(done);
	})
	
	afterEach(function(done) {
		destroyServer(done);
	})
	
	it('Attaches the plugin to Hapi server configuration', function() {
		expect(server.plugins.harvester.version).to.equal('0.1.0')
	})
	
	it('should have the injectThen method available', function() {
  		return server.injectThen({method: 'GET', url: '/chuck'})
		.then((res) => {
			expect(res.result).to.deep.equal({ statusCode: 404, error: 'Not Found' })
		})
	})
	
	it('all the REST verbs available', function() {

		const hh = server.plugins.harvester;
		
		let promises = [];

		['get', 'put', 'post', 'patch', 'delete'].forEach(function(verb) {
			server.route(hh.routes[verb](schema))
			
			let promise = server.injectThen({method: verb.toUpperCase(), url: '/brands'}).then((res) => {
				expect(res.result).to.deep.equal({ foo: 'bar' })
			})
			
			promises.push(promise)
		})
		
		return server.injectThen({method: 'GET', url: '/chuck'})
		return Promise.all(promises)
	})
})

buildServer = function(done) {
	const Hapi = require('hapi')
	server = new Hapi.Server()
    server.connection()
	server.register([
		{register: require('../lib/plugin')},
		{register: require('inject-then')}
	], done)
}

destroyServer = function(done) {
	server.stop(done)
}