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

describe.only('Model syntax sugar', function () {

    beforeEach(function () {
        return utils.buildDefaultServer()
    })

    afterEach(utils.createDefaultServerDestructor())

    it('should set the model in the server for a schema', function () {
        harvester.model.create(schema.brands);
        expect(server.plugins['hapi-harvester'].model.type).to.be.eq(schema.type)
    })
})
