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
})

var buildServer = function(done) {
	const Hapi = require('hapi')
	server = new Hapi.Server()
    server.connection()
	server.register({register: require('../lib/plugin')}, done)
}

var destroyServer = function(done) {
	server.stop(done)
}