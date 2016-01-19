'use strict'

const _ = require('lodash')
const mongoose = require('mongoose')
const Converters = require('./converters');
const debug = require('debug')('hh-adapter')
const Promise = require('bluebird')
const Hoek = require('hoek')

const connection = require('./connection')

mongoose.Promise = Promise

module.exports = function (mongodbUrl, options) {

    const converters = Converters();
    const models = {};

    options = options || {}

    Hoek.assert(mongodbUrl, 'mongodbUrl missing')

    const db = mongoose.createConnection()

    const connect = function () {
        return connection.connect(db, mongodbUrl, options)
    }

    const disconnect = function () {
        return connection.disconnect(db)
    }

    const find = function (type, filter, skip, limit, sort, fields) {
        const model = models[type]
        var predicate = converters.toMongoosePredicate(filter)

        return model.find(predicate).skip(skip).sort(converters.toMongooseSort(sort))
            .limit(limit).lean().exec()
            .then((resources)=> {
                let data = converters.toJsonApi(resources);
                if (fields) {
                    data = _.map(data, (datum) => {
                        datum.attributes = _.pick(datum.attributes, fields)
                        return datum
                    })
                }

                return data
            })
    }

    const findById = function (type, id, fields) {

        const model = models[type]
        return model.findById(id).lean().exec()
            .then((resources) => {
                if (!resources) {
                    return null
                }
                const data = converters.toJsonApi(resources);
                if (fields) {
                    data.attributes = _.pick(data.attributes, fields);
                }
                return data
            })
    }

    const create = function (type, data) {
        const model = models[type]
        if (data.id) {
            data._id = data.id;
            delete data.id;
        }
        return model.create(data)
            .then((created) => {
                return converters.toJsonApi(created.toObject())
            })
    }

    const update = function (type, id, data) {
        const model = models[type]
        return model.findByIdAndUpdate(id, data)
            .then((resource) => {
                if (!resource) {
                    return null
                }
                return findById(type, id)
            })
    }

    const del = function (type, id) {
        const model = models[type]
        const predicate = converters.toMongoosePredicate({id: id})
        return model.remove(predicate)
            .then(() => {
                return {}
            })
    }

    const processSchema = function (hhSchema) {
        if (!models[hhSchema.type]) {

            // clean up existing models and schemas
            //delete db.models[hhSchema.type]
            //delete db.modelSchemas[hhSchema.type]

            models[hhSchema.type] = converters.toMongooseModel(db, hhSchema)
        }
        return models[hhSchema.type]
    }

    return {
        connect,
        disconnect,
        find,
        findById,
        options,
        create,
        update,
        delete: del,
        models,
        processSchema
    }

}
