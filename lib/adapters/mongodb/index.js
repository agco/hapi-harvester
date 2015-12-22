
'use strict'

const _ = require('lodash')
const mongoose = require('mongoose')
const Converters = require('./converters');
const url = require('url')
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
            debug(`dockerHostUrl: ${dockerHostUrl}`)
            if (dockerHostUrl && dockerHostUrl !== 'null' && dockerHostUrl!=='undefined') {
                var dockerHostName = url.parse(dockerHostUrl).hostname;
                fallbackAndConnect(dockerHostName,
                    `mongodbUrl is not specified, fallback to Mongodb on Docker host : ${dockerHostName}`, cb);
            } else {
                fallbackAndConnect('localhost',
                    `mongodbUrl is not specified and DOCKER_HOST env variable is neither, fallback to Mongodb on localhost`, cb);
            }
        }
    }

    function fallbackAndConnect(hostName, debugMsg, cb) {
        const fallbackMongodbUrl = `mongodb://${hostName}:27017/sample`
        debug(debugMsg)
        options.mongodbUrl = fallbackMongodbUrl
        checkAndSetOplogUrl(fallbackMongodbUrl);
        mongoose.connect(fallbackMongodbUrl, cb)
    }

    function checkAndSetOplogUrl(mongodbUrl) {
        var oplogConnectionString = options.oplogConnectionString;
        if (!oplogConnectionString) {
            options.oplogConnectionString = guessOplogUrl(mongodbUrl)
            debug(`oplogConnectionString not specified, guessing url should be : ${options.oplogConnectionString}`)
        }
    }

    function guessOplogUrl(mongodbUrl) {
        return mongodbUrl.substring(0, mongodbUrl.lastIndexOf('/')) + '/local';
    }

    const disconnect = function (cb) {
        //clear out events
        mongoose.connection._events = {}
        mongoose.disconnect(cb)
    }

    mongoose.connection.on('error', connect)

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
