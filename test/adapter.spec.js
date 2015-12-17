'use strict'

const _ = require('lodash')
const Hapi = require('hapi')
const utils = require('./utils');

describe('Adapter Validation', function () {

    it('Will succeed if passed a valid adapter ', function () {

        let adapter = require('../').getAdapter('mongodb')()
        expect(buildServerSetupWithAdapter(adapter)).to.not.throw(Error)
    })

    it('Will fail if the given adapter is missing a required function', function () {

        let adapter = require('../').getAdapter('mongodb')()
        adapter = _.omit(adapter, 'delete');
        expect(buildServerSetupWithAdapter(adapter)).to.throw('Adapter validation failed. Adapter missing delete')
    })

    it('Will won\'t accept a string adapter if it doesn\'t exist ', function () {
        function constructAdapter() {
            require('../').getAdapter('nonexistant')
        }
        expect(constructAdapter).to.throw(Error)
    })

})

function buildServerSetupWithAdapter(adapter) {
    return function () {
        var server = new Hapi.Server()
        server.connection()

        server.register([
            {register: require('../'), options: {adapter: adapter}},
            {register: require('inject-then')}
        ], () => {
            server.start(()=> {
            })
        })
    }
}

