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
        const limit = (query.page && query.page.limit) || 1000
        const skip = (query.page && query.page.offset) || 0
        const sort = converters.toMongooseSort(query.sort)
        const include = query.include && query.include.split(',')
        var predicate = converters.toMongoosePredicate(query)
        return model.find(predicate).skip(skip).sort(sort).limit(limit).lean().exec()
            .then((resources)=> {
                let data  = converters.toJsonApi(resources);
                if (include) {
                    data = _.map(data, (datum) => {
                        datum.attributes = _.pick(datum.attributes, include)
                        return datum
                    })
                }
                
                return {data}
            })
            .catch((err) => {
                return Boom.badImplementation()
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
                return Boom.badImplementation()
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
                return Boom.badImplementation()
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
                return Boom.badImplementation()
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
                return Boom.badImplementation()
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
