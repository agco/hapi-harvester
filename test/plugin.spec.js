'use strict'

let server;

describe('Plugin', function() {
	beforeEach(function() {
		buildServer();
	})
	
	afterEach(function(done) {
		destroyServer(done);
	})
	it('Attaches the plugin to Hapi server configuration', function() {
		console.log(server.plugins)
	});
})

var buildServer = function() {
	const Hapi = require('hapi')
	server = new Hapi.Server()
    server.connection()
    return server
}

var destroyServer = function(done) {
	server.stop(done)
}