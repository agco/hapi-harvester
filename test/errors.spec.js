'use strict'

const Joi = require('joi')
const should = require('should')
const Promise = require('bluebird')

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

const data = {
    type: 'brands',
    attributes: {
        code: 'MF',
        description: 'Massey Furgeson'
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

    describe('Given a duplicate post that voilates a uniqueness constraint on a collection', () => {
        let Brands

        beforeEach(() => {
            Brands = server.plugins['hapi-harvester'].adapter.models.brands

            return Brands.remove({})
            .then(() => {
                // create uniqueness constraint on db
                return Brands.schema.path('attributes.code').index({ unique: true, sparse: true })
            })
            .then(() => {
                return Brands.ensureIndexes((err) => {
                    if (err) console.log('ensureIndexes:', err)
                })
            })
            .then(() => {
                // seed brand test data
                return Brands.create(data);
            })
        })

        after(() => {
            Brands.remove({})
                .then(() => {
                    Brands.collection.dropAllIndexes((err) => {
                        if (err) console.log('dropAllIndexes:', err)
                    })
                })
        })


        it('returns a 409 error to the client', () => {
            let duplicateBrand = data
            return server.injectThen({ method: 'post', url: '/brands', payload: { data: duplicateBrand }})
            .then((res) => {
                expect(res.statusCode).to.equal(409)
            })
        })
    })
})
