'use strict'

// dependencies
const Joi = require('joi')
const Mongoose = require('mongoose')

const config = require('./config')


// module under test
const converters = require('../lib/adapters/mongodb/converters')()


describe('Unit tests for converters module', function () {
    let db

    before(function () {
        return new Promise((resolve, reject) => {
            Mongoose.connect(config.mongodbUrl)

            db = Mongoose.connection
            db.on('error', reject)
            db.on('open', resolve)
        })
    })

    after(function () {
        return db && db.close()
    })

    describe('funciton toMongooseModel', function () {

        it('should exist as a funciton', function () {
            expect(converters.toMongooseModel).to.be.a.Function
        })

        it('should not fail when Joi.object() types are used in a schema', function () {
            const hhSchema = {
                type: 'testObject',
                attributes: {
                    anObject: Joi.object()
                }
            }
            expect(converters.toMongooseModel(db, hhSchema)).to.be.a.Function
        })
    })
})
