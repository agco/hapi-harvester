'use strict'

const chai = require('chai')
const _ = require('lodash')
const Promise = require('bluebird')

chai.use(require('chai-things'))

chai.config.includeStack = true

global.expect = chai.expect
global.AssertionError = chai.AssertionError
global.Assertion = chai.Assertion
global.assert = chai.assert
global.utils = {
    getData: (res) => {
        const data = res.result.data;
        return _.omit(data, 'id')
    },
    removeFromDB: (server, collection) => {
        const model =  server.plugins.harvester.adapter.models['brands']
        return model.remove({}).lean().exec()  
    },
    buildServer: (schema) => {
        let server, hh;
        const Hapi = require('hapi')
        const plugin = require('../')
        const adapter = plugin.getAdapter('mongodb')
        server = new Hapi.Server()
        server.connection({port : 9100})
        return new Promise((resolve) => {
            server.register([
                {register: require('../'), options: {adapter: adapter({mongodbUrl: 'mongodb://localhost/test'})}},
                {register: require('inject-then')}
            ], () => {
                hh = server.plugins.harvester;
                server.start(() => {
                    ['get', 'getById', 'post', 'patch', 'delete'].forEach(function(verb) {
                        server.route(hh.routes[verb](schema))
                    })
                    resolve({server, hh})
                })  
            })
        })
    }
}