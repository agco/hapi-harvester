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
        
        let headers = {
            'content-type' : 'text/html'
        }
        
        server.route(hh.routes.post(schema))

       return server.injectThen({method: 'post', url: '/brands', headers : headers}).then((res) => {
            expect(res.statusCode).to.equal(415)
        })
    })
    
    it('should allow all request with content-type set to application/json', function() {
        let headers = {
            'content-type' : 'application/json'
        }
        
        server.route(hh.routes.post(schema))
        
        server.injectThen({method: 'post', url: '/brands', headers: headers, payload: {data}})
            .then((res) => {
                expect(res.statusCode).to.equal(201)
            })
    })
})

buildServer = function(done) {
    const Hapi = require('hapi')
    const plugin = require('../')
    let adapter = plugin.getAdapter('mongodb')
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