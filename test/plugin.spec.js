'use strict'

const Joi = require('joi')
const utils = require('./utils');
const Hapi = require('hapi');
const url = require('url');
const version = require('../package').version

let server, buildServer, destroyServer;

const schema = {
    type: 'brands',
    attributes: {
        code: Joi.string().min(2).max(10),
        description: Joi.string()
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
        expect(server.plugins['hapi-harvester'].version).to.equal(version)
    })

    it('should have the injectThen method available', function() {
        return server.injectThen({method: 'GET', url: '/chuck'})
        .then((res) => {
            expect(res.result).to.deep.equal({ errors: [ { status: 404, title: 'Not Found' } ] })
        })
    })

    it('only sends the available verbs on OPTIONS call', function() {

        ['get', 'post', 'patch', 'delete'].forEach(function(verb) {
            server.route(server.plugins['hapi-harvester'].routes[verb](schema))
        })

        return server.injectThen({method: 'OPTIONS', url: '/brands'})
        .then(function(res) {
            expect(res.headers.allow.split(',').sort()).to.eql('OPTIONS,GET,POST,PATCH,DELETE'.split(',').sort())
        })
    })

    it('performs a fallback if an adapter is not provided', function (done) {

        server = new Hapi.Server()
        server.connection()
        server.register([
            require('../lib/plugin')
        ], () => {
            const harvester = server.plugins['hapi-harvester'];
            server.start(()=> {
                expect(harvester.adapter.options.mongodbUrl).to.not.be.null
                expect(harvester.adapter.options.oplogConnectionString).to.not.be.null
                done()
            })
        })
    })

})

buildServer = function(done) {
    server = new Hapi.Server()
    server.connection()
    server.register([
        require('../'),
        require('inject-then')
    ], function() {
        server.start(done)
    })
}

destroyServer = function(done) {
    server.stop(done)
}
