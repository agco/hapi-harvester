'use strict'

const Joi = require('joi')
const utils = require('./utils');
const Hapi = require('hapi');
const url = require('url');
const config = require('./config');

let server, buildServer, destroyServer;

const schema = {
    type: 'brands',
    attributes: {
        code: Joi.string().min(2).max(10),
        description: Joi.string()
    }
};

describe('Plugin Basics', function () {

    beforeEach(function (done) {
        buildServer(done);
    })

    afterEach(function (done) {
        destroyServer(done);
    })

    it('Attaches the plugin to Hapi server configuration', function () {
        expect(server.plugins['hapi-harvester'].version).to.equal('0.1.0')
    })

    it('should have the injectThen method available', function () {
        return server.injectThen({method: 'GET', url: '/chuck'})
            .then((res) => {
                expect(res.result).to.deep.equal({errors: [{status: 404, title: 'Not Found'}]})
            })
    })

    it('only sends the available verbs on OPTIONS call', function () {

        ['get', 'post', 'patch', 'delete'].forEach(function (verb) {
            server.route(server.plugins['hapi-harvester'].routes[verb](schema))
        })

        return server.injectThen({method: 'OPTIONS', url: '/brands'})
            .then(function (res) {
                expect(res.headers.allow.split(',').sort()).to.eql('OPTIONS,GET,POST,PATCH,DELETE'.split(',').sort())
            })
    })

    it('fails if an adapter is not provided', function (done) {

        function bootstrapWithoutAdapter() {
            server = new Hapi.Server()
            server.connection()
            server.register([{
                register: require('../lib/plugin'),
                options: {
                    adapterSSE: require('../lib/adapters/mongodb/sse')(config.mongodbOplogUrl)
                }
            }], ()=>{})
        }

        expect(bootstrapWithoutAdapter).to.throw(Error)
        done()
    })

    it('fails if an adapterSSE is not provided', function (done) {

        function bootstrapWithoutAdapter() {
            server = new Hapi.Server()
            server.connection()
            server.register([{
                register: require('../lib/plugin'),
                options: {
                    adapter: require('../lib/adapters/mongodb')(config.mongodbUrl)
                }
            }], ()=>{})
        }

        expect(bootstrapWithoutAdapter).to.throw(Error)
        done()
    })

})

buildServer = function (done) {
    server = new Hapi.Server()
    server.connection()

    const harvester = require('../')
    const mongodbAdapter = require('../lib/adapters/mongodb')
    const mongodbSSEAdapter = require('../lib/adapters/mongodb/sse')

    server.register([
        {
            register: harvester,
            options: {
                adapter: mongodbAdapter(config.mongodbUrl),
                adapterSSE: mongodbSSEAdapter(config.mongodbOplogUrl)
            }
        },
        require('inject-then')
    ], ()=> {
        server.start(done)
    })
}

destroyServer = function (done) {
    server.stop(done)
}
