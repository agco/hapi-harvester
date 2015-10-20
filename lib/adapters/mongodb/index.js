'use strict'

const Hapi = require('hapi')
const _ = require('lodash')
const mongoose = require('mongoose')
const converters = require('./converters')
const utils = require('./utils')

mongoose.Promise = require('bluebird')

module.exports = function (options) {

    let models = {}

    let connect = function(cb) {
        mongoose.connect(options.mongodbUrl, cb)
    }

    let disconnect = function(cb) {
        //clear out events
        mongoose.connection._events = {}
        mongoose.disconnect(cb)
    }
    
    mongoose.connection.on('error', connect)

    let find = function (type, req) {

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

    let findById = function(type, req) {

        const model = models[type]
        return model.findById(req.params.id).lean().exec()
            .then((resources) => {
                return {data: converters.toJsonApi(resources)}
            })
            .catch((err) => {
                console.log(err)
            })

    }

    let create = function(type, req) {
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
    
    let update = function(type, req) {

        const model = models[type]
        var data = utils.getPayload(req)
        return model.findByIdAndUpdate(req.params.id, data)
            .then((updated) => {
                return {data: converters.toJsonApi(updated.toObject())}
            })
            .catch((err) => {
                console.log(err)
            })

    }
    
    let del = function(type, req) {
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

    let processSchema = function(hhSchema) {

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
