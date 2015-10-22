'use strict'

const Hapi = require('hapi')
const Boom = require('boom')
const _ = require('lodash')
const mongoose = require('mongoose')
const converters = require('./converters')()
const utils = require('./utils')()

mongoose.Promise = require('bluebird')

module.exports = function (options) {

    const models = {}

    const connect = function(cb) {
        mongoose.connect(options.mongodbUrl, cb)
    }

    const disconnect = function(cb) {
        //clear out events
        mongoose.connection._events = {}
        mongoose.disconnect(cb)
    }
    
    mongoose.connection.on('error', connect)

    const find = function (type, req) {

        const model = models[type]
        const query = req.query
        const limit = query.limit || 1000
        const skip = query.offset || 0
        const sort = query.sort || {'_id': -1}
        var predicate = converters.toMongoosePredicate(query)
        return model.find(predicate).skip(skip).sort(sort).limit(limit).lean().exec()
            .then((resources)=> {
                return {data: converters.toJsonApi(resources)}
            })
            .catch((err) => {
                console.log(err)
            })

    }

    const findById = function(type, req) {

        const model = models[type]
        return model.findById(req.params.id).lean().exec()
            .then((resources) => {
                if (!resources) {
                    return Boom.notFound()
                }
                return {data: converters.toJsonApi(resources)}
            })
            .catch((err) => {
                console.log(err)
            })

    }

    const create = function(type, req) {
        const model = models[type]
        var data = utils.getPayload(req)
        return model.create(data)
            .then((created) => {
                return {data: converters.toJsonApi(created.toObject())}
            })
            .catch((err) => {
                console.log(err)
            })

    }
    
    const update = function(type, req) {

        const model = models[type]
        var data = utils.getPayload(req)
        return model.findByIdAndUpdate(req.params.id, data)
            .then((resource) => {
                if (!resource) {
                    return Boom.notFound()
                }
                return findById(type, req)
            })
            .catch((err) => {
                console.log(err)
            })

    }
    
    const del = function(type, req) {
        const model = models[type]
        var predicate = converters.toMongoosePredicate({id: req.params.id})
        return model.remove(predicate)
            .then(() => {
                return {}
            })
            .catch((err) => {
                console.log(err)
            })
    }

    const processSchema = function(hhSchema) {

        if (!models[hhSchema.type]) {

            // clean up existing models and schemas
            delete mongoose.models[hhSchema.type]
            delete mongoose.modelSchemas[hhSchema.type]

            models[hhSchema.type] = converters.toMongooseModel(hhSchema)
        }
        return models[hhSchema.type]
    }

    return {
        connect,
        disconnect,
        find,
        findById,
        create,
        update,
        delete: del,
        models,
        processSchema
    }

}
