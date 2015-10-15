'use strict'

const Joi = require('joi')
const Promise = require('bluebird')

let server, buildServer, destroyServer, hh;

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
		
		let promises = [];

		['get', 'put', 'post', 'patch', 'delete'].forEach(function(verb) {
			server.route(hh.routes[verb](schema))
			
			let promise = server.injectThen({method: verb.toUpperCase(), url: '/brands'}).then((res) => {
				expect(res.result).to.deep.equal({ foo: 'bar' })
			})
			
			promises.push(promise)
		})
		
		return Promise.all(promises)
	})
	
	it('only sends the available verbs on OPTIONS call', function() {

		['get', 'put', 'post', 'patch', 'delete'].forEach(function(verb) {
			server.route(hh.routes[verb](schema))
		})
		
		return server.injectThen({method: 'OPTIONS', url: '/brands'})
		.then(function(res) {
			expect(res.headers.allow).to.equal('OPTIONS,GET,PUT,POST,PATCH,DELETE')
		})
	})
	
	it('should set the content-type header to application/json by default', function() {
		server.route(hh.routes.get(schema))
  		return server.injectThen({method: 'GET', url: '/brands'})
		.then((res) => {
			expect(res.headers['content-type']).to.equal('application/json; charset=utf-8')
		})
	})
	
	it('should reject all request with content-type not set to application/json', function() {

		let promises = [];

		['put', 'post', 'patch'].forEach(function(verb) {
			server.route(hh.routes[verb](schema))
			
			let headers = {
				'content-type' : 'text/html'
			} 
			
			let promise = server.injectThen({method: verb.toUpperCase(), url: '/brands', headers : headers}).then((res) => {
				expect(res.statusCode).to.equal(415)
				
			})
			
			promises.push(promise)
		})
		
		return Promise.all(promises)
	})
	
	it('should allow all request with content-type set to application/json', function() {

		let promises = [];

		['put', 'post', 'patch'].forEach(function(verb) {
			server.route(hh.routes[verb](schema))
			
			let headers = {
				'content-type' : 'application/json'
			} 

			let promise = server.injectThen({method: verb.toUpperCase(), url: '/brands', headers : headers}).then((res) => {
				expect(res.statusCode).to.equal(200)
			})
			
			promises.push(promise)
		})
		
		return Promise.all(promises)
	})
})

buildServer = function(done) {
	const Hapi = require('hapi')
	server = new Hapi.Server()
	server.connection({port : 9100})
	server.register([
		{register: require('../lib/plugin')},
		{register: require('inject-then')}
	], () => {
		hh = server.plugins.harvester;
		server.start(done)	
	})
}

destroyServer = function(done) {
	server.stop(done)
}