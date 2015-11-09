'use strict'

const Hapi = require('hapi')
const Joi = require('joi')
const should = require('should')

let server, buildServer, destroyServer, hh

const schema = {
    type: 'brands',
    attributes: {
        code: Joi.string().min(2).max(10),
        year: Joi.number(),
        series: Joi.number(),
        description: Joi.string()
    }
}

const data = {
    type: 'brands',
    attributes: {
        code: 'MF',
        year: 2007,
        series: 5,
        description: 'Massey Furgeson'
    }
}

describe('Global Error Handling', function () {
	beforeEach(function (done) {
		buildServer(() => {
			done();
		})
	})

    afterEach(function (done) {
        destroyServer(done)
    })

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

buildServer = function(done) {
    return utils.buildServer(schema)
        .then((res) => {
            server = res.server
            hh = res.hh
            done()
        })
}

destroyServer = function(done) {
    utils.removeFromDB(server, 'brands')
    .then((res) => {
        server.stop(done)
    })
}