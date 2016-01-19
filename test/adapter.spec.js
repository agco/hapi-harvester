'use strict'

const _ = require('lodash')
const Hapi = require('hapi')
const utils = require('./utils');
const config = require('./config');

describe('Adapter Validation', function () {

    const harvester = require('../')
    const mongodbAdapter = harvester.getAdapter('mongodb')
    const mongodbSSEAdapter = harvester.getAdapter('mongodb/sse')

    it('Will succeed if passed a valid adapter ', function () {

        expect(buildServerSetupWithAdapters(
                mongodbAdapter(config.mongodbUrl),
                mongodbSSEAdapter(config.mongodbOplogUrl)
            )).to.not.throw(Error)
    })

    it('Will fail if the given adapter is missing a required function', function () {

        let adapter = mongodbAdapter(config.mongodbUrl)
        adapter = _.omit(adapter, 'delete');
        expect(buildServerSetupWithAdapters(
            adapter,
            mongodbSSEAdapter(config.mongodbOplogUrl)
        )).to.throw('Adapter validation failed. Adapter missing delete')
    })

    it('Will won\'t accept a string adapter if it doesn\'t exist ', function () {
        function constructAdapter() {
            harvester.getAdapter('nonexistant')
        }
        expect(constructAdapter).to.throw(Error)
    })

})

function buildServerSetupWithAdapters(adapter, adapterSSE) {
    return function () {
        var server = new Hapi.Server()
        server.connection()

        server.register([
            {register: require('../'), options: {
                adapter: adapter,
                adapterSSE: adapterSSE
            }},
            {register: require('inject-then')}
        ], () => {
            server.start(()=> {
            })
        })
    }
}

