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
        expect(server.plugins['hapi-harvester'].version).to.equal(require('../package.json').version)
    })

    it('should have the injectThen method available', function () {
        return server.injectThen({method: 'GET', url: '/chuck'})
            .then((res) => {
                expect(res.result).to.deep.equal({errors: [{status: 404, title: 'Not Found'}]})
            })
    })

    it('only sends the available verbs on OPTIONS call', function () {

        server.route(server.plugins['hapi-harvester'].routes.pick(schema, ['get', 'post', 'patch', 'delete', 'options']))

        return server.injectThen({method: 'OPTIONS', url: '/brands'})
            .then(function (res) {
                expect(res.headers.allow.split(',').sort()).to.eql('OPTIONS,GET,POST,PATCH,DELETE'.split(',').sort())
            })
    })

    it('fails if an adapter is not provided', function (done) {

        function bootstrapWithoutAdapter() {
            server = new Hapi.Server()
            server.connection()
            const harvester = require('../lib/plugin')
            server.register([{
                register: harvester,
                options: {
                    adapterSSE: harvester.getAdapter('mongodb/sse')(config.mongodbOplogUrl)
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
            const harvester = require('../lib/plugin')
            server.register([{
                register: harvester,
                options: {
                    adapter: harvester.getAdapter('mongodb')(config.mongodbUrl)
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
    const mongodbAdapter = harvester.getAdapter('mongodb')
    const mongodbSSEAdapter = harvester.getAdapter('mongodb/sse')

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
