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

const data = {
    type: 'brands',
    attributes: {
        code: 'MF',
        description: 'Massey Furgeson'
    }
};

describe('Plugin Basics', function() {
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
    
    it('only sends the available verbs on OPTIONS call', function() {

        ['get', 'post', 'patch', 'delete'].forEach(function(verb) {
            server.route(hh.routes[verb](schema))
        })
        
        return server.injectThen({method: 'OPTIONS', url: '/brands'})
        .then(function(res) {
            expect(res.headers.allow).to.equal('OPTIONS,GET,POST,PATCH,DELETE')
        })
    })
})

buildServer = function(done) {
    const Hapi = require('hapi')
    const plugin = require('../')
    const adapter = plugin.getAdapter('mongodb')
    server = new Hapi.Server()
    server.connection({port : 9100})
    server.register([
        {register: require('../'), options: {adapter: adapter({mongodbUrl: 'mongodb://localhost/test'})}},
        {register: require('inject-then')}
    ], function() {
        hh = server.plugins.harvester;
        server.start(done)  
    })
}

destroyServer = function(done) {
    server.stop(done)
}