'use strict'

const chai = require('chai')
const _ = require('lodash')

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
    }
}