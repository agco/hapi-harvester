'use strict'

const Hapi = require('hapi')
const Hoek = require('hoek')
const Boom = require('boom')
const _ = require('lodash')
const mongoose = require('mongoose')
const Converters = require('./converters');
const utils = require('./utils')()
const url = require('url')
const portscanner = require('portscanner')
const debug = require('debug')('hh-adapter')

mongoose.Promise = require('bluebird')

module.exports = function (options) {

    const converters = Converters();
    const models = {};

    options = options || {}

    const connect = function (cb) {

        var mongodbUrl = options.mongodbUrl;
        if (mongodbUrl) {
            checkAndSetOplogUrl(mongodbUrl);
            mongoose.connect(mongodbUrl, cb)
        } else {
            // if mongodbUrl is not passed as part of the options
            // establish a connection to a Mongodb running with 27017 on the DOCKER_HOST
            const dockerHostUrl = process.env.DOCKER_HOST
            if (dockerHostUrl) {
                const dockerMongodbUrl = `mongodb://${url.parse(dockerHostUrl).hostname}:27017/sample`
                options.mongodbUrl = dockerMongodbUrl
                debug(`mongodbUrl not specified, fallback to default Dockerized Mongodb : ${dockerMongodbUrl}`)
                checkAndSetOplogUrl(dockerMongodbUrl);
                mongoose.connect(dockerMongodbUrl, cb)
            } else {
                // give up if no DOCKER_HOST can be found
                cb(new Error(`mongodbUrl not specified and no Docker runtime detected`))
            }
        }
    }

    function checkAndSetOplogUrl(mongodbUrl) {
        var oplogConnectionString = options.oplogConnectionString;
        if (!oplogConnectionString) {
            options.oplogConnectionString = guessOplogUrl(mongodbUrl)
            debug(`oplogConnectionString not specified, guessing url should be : ${options.oplogConnectionString}`)
        }
    }

    //
    function guessOplogUrl(mongodbUrl) {
        return mongodbUrl.substring(0, mongodbUrl.lastIndexOf('/')) + '/local';
    }

    const disconnect = function (cb) {
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
        const sparse = query.fields && query.fields[type] && query.fields[type].split(',');
        var predicate = converters.toMongoosePredicate(query)
        return model.find(predicate).skip(skip).sort(sort).limit(limit).lean().exec()
            .then((resources)=> {
                let data = converters.toJsonApi(resources);
                if (sparse) {
                    data = _.map(data, (datum) => {
                        datum.attributes = _.pick(datum.attributes, sparse)
                        return datum
                    })
                }

                return {data}
            })
    }

    const findById = function (type, req) {

        const model = models[type]
        const query = req.query;
        const sparse = query.fields && query.fields[type] && query.fields[type].split(',');
        return model.findById(req.params.id).lean().exec()
            .then((resources) => {
                if (!resources) {
                    throw Boom.notFound()
                }
                const data = converters.toJsonApi(resources);
                if (sparse) {
                    data.attributes = _.pick(data.attributes, sparse);
                }
                return {data: data}
            })
    }

    const create = function (type, req) {
        const model = models[type]
        var data = utils.getPayload(req)
        if (data.id) {
            data._id = data.id;
            delete data.id;
        }
        return model.create(data)
            .then((created) => {
                return {data: converters.toJsonApi(created.toObject())}
            })
    }

    const update = function (type, req) {

        const model = models[type]
        var data = utils.getPayload(req)
        return model.findByIdAndUpdate(req.params.id, data)
            .then((resource) => {
                if (!resource) {
                    return Boom.notFound()
                }
                return findById(type, req)
            })
    }

    const del = function (type, req) {
        const model = models[type]
        var predicate = converters.toMongoosePredicate({id: req.params.id})
        return model.remove(predicate)
            .then(() => {
                return {}
            })
    }

    const processSchema = function (hhSchema) {

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
        options,
        create,
        update,
        delete: del,
        models,
        processSchema
    }

}
