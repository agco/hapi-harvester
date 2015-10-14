'use strict'

let server;

describe('Plugin', function() {
	beforeEach(function(done) {
		buildServer(done);
	})
	
	afterEach(function(done) {
		destroyServer(done);
	})
	it('Attaches the plugin to Hapi server configuration', function() {
		expect(server.plugins.harvester.version).to.equal('0.1.0')
	});
	
	it('should fail with a descriptive error', function() {
  		return server.injectThen({method: 'GET', url: '/chuck'})
		.then(function(res) {
			expect(res.result).to.deep.equal({ statusCode: 404, error: 'Not Found' });
		});
	});
})

var buildServer = function(done) {
	const Hapi = require('hapi')
	server = new Hapi.Server()
    server.connection()
	server.register([
		{register: require('../lib/plugin')},
		{register: require('inject-then')}
	], done)
}

var destroyServer = function(done) {
	server.stop(done)
}