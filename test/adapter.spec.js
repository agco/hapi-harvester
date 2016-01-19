'use strict'

const _ = require('lodash')
const Hapi = require('hapi')
const utils = require('./utils');

describe('Adapter Validation', function () {

    const mongodbAdapter = require('../lib/adapters/mongodb')
    const mongodbSSEAdapter = require('../lib/adapters/mongodb/sse')

    it('Will succeed if passed a valid adapter ', function () {

        expect(buildServerSetupWithAdapters(
                mongodbAdapter('mongodb://192.168.59.103/test'),
                mongodbSSEAdapter('mongodb://192.168.59.103/local')
            )).to.not.throw(Error)
    })

    it('Will fail if the given adapter is missing a required function', function () {

        let adapter = mongodbAdapter('mongodb://192.168.59.103/test')
        adapter = _.omit(adapter, 'delete');
        expect(buildServerSetupWithAdapters(
            adapter,
            mongodbSSEAdapter('mongodb://192.168.59.103/local')
        )).to.throw('Adapter validation failed. Adapter missing delete')
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

