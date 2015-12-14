'use strict'

const Joi = require('joi')
const utils = require('./utils');
const config = require('./config')

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
        expect(server.plugins.harvester.version).to.equal('0.1.0')
    })

    it('should have the injectThen method available', function() {
        return server.injectThen({method: 'GET', url: '/chuck'})
        .then((res) => {
            expect(res.result).to.deep.equal({ errors: [ { status: 404, title: 'Not Found' } ] })
        })
    })

    it('only sends the available verbs on OPTIONS call', function() {

        ['get', 'post', 'patch', 'delete'].forEach(function(verb) {
            server.route(server.plugins.harvester.routes[verb](schema))
        })

        return server.injectThen({method: 'OPTIONS', url: '/brands'})
        .then(function(res) {
            expect(res.headers.allow.split(',').sort()).to.eql('OPTIONS,GET,POST,PATCH,DELETE'.split(',').sort())
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
        {register: require('../'), options: {adapter: adapter({mongodbUrl: config.getMongodbUrl('test'), baseUri: server.info.uri})}},
        {register: require('inject-then')}
    ], function() {
        server.start(done)
    })
}

destroyServer = function(done) {
    server.stop(done)
}
