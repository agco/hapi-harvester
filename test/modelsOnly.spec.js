'use strict'

const _ = require('lodash')
const Joi = require('joi')
const utils = require('./utils')

const schema = {
    brands: {
        type: 'brands',
        attributes: {
            code: Joi.string().min(2).max(10),
            year: Joi.number(),
            series: Joi.number(),
            description: Joi.string()
        }
    }
}

describe('Models syntax sugar', function () {

    beforeEach(function () {
        return utils.buildDefaultServer()
    })

    afterEach(utils.createDefaultServerDestructor())

    it('should set the models in the server for a schema', function () {
        harvester.models.set(schema.brands);
        expect(server.plugins['hapi-harvester'].models).to.not.be.undefined
        //expect(harvester.adapter.routes).to.be.undefined
    })

    // it('should set the models in the server for a schema and not set the routes', function () {
    //     harvester.models.set(schema.brands);
    //     expect(server.plugins['hapi-harvester'].routes).to.be.undefined
    //     //expect(harvester.adapter.routes).to.be.undefined
    // })



})
