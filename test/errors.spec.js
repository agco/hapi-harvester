'use strict'

const Joi = require('joi')
const should = require('should')

const seeder = require('./seeder')
const utils = require('./utils')

const schema = {
    brands: {
        type: 'brands',
        attributes: {
            code: Joi.string().min(2).max(10),
            description: Joi.string()
        }
    }
};

describe('Global Error Handling', function () {

    before(() => {
        return utils.buildDefaultServer(schema)
    })

    after(utils.createDefaultServerDestructor())

	describe('Given a request for an invalid resource', function () {
		it('should return a JSON+API compliant error', function () {
			return server.injectThen({ method: 'get', url: '/some/bogus/request'})
			.then(res => {
				res.statusCode.should.equal(404)
				expect(res.headers['content-type']).to.equal('application/vnd.api+json')
                should.exist(res.payload)
                let payload = JSON.parse(res.payload)
                payload.should.have.property('errors').and.be.an.Array
                payload.should.not.have.property('data')
                payload.errors.length.should.be.above(0)
                let error = payload.errors[0]
                error.should.have.property('status').and.equal(404)
                error.should.have.property('title').and.equal('Not Found')
			})
		})
	})

})
