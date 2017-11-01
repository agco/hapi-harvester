'use strict'

const _ = require('lodash')
const mongoose = require('mongoose')
const Converters = require('./converters');
const debug = require('debug')('hh-adapter')
const Promise = require('bluebird')
const Hoek = require('hoek')
const dot = require('dot-object');
const EventEmitter = require('events');

const connection = require('./connection')

mongoose.Promise = Promise

module.exports = function (mongodbUrl, options) {

    const converters = Converters();
    const models = {};
    const hooks = {};

    options = options || {}

    Hoek.assert(mongodbUrl, 'mongodbUrl missing')

    var db

    const connect = function () {
        return connection.connect(mongodbUrl, options).then((dbConnected)=>{
            // todo hate to go back to an approach using vars
            // however the whole adapter connect concept needs to be refactored to properly support an immutable approach
            db = dbConnected
        })
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

    const create = function (type, data, options) {
        options = options || {};
        const model = models[type]
        if (data.id) {
            data._id = data.id;
            delete data.id;
        }
        return model.create(data)
            .then((resource) => {
                const created = converters.toJsonApi(resource.toObject());
                if(!options.skipHooks){
                    hooks[type].emit('postCreate', created);
                }
                return created;
            })
    }

    const update = function (type, id, data, options) {
      options = options || {};
      const model = models[type]
        return model.findByIdAndUpdate(id, data)
            .then((resource) => {
                if (!resource) {
                    return null
                }
                return findById(type, id)
            })
            .then(resource => {
                if(resource && !options.skipHooks){
                    hooks[type].emit('postUpdate', resource);
                }
                return resource;
            })
    }

    const patch = function(type, id, data, options) {
      options = options || {};
      const model = models[type]
        const patchObject = dot.dot(data);
        return model.findByIdAndUpdate(id, {$set: patchObject})
        .then((resource) => {
            if (!resource) {
                return null
            }
            return findById(type, id)
        })
        .then(resource => {
            if(resource && !options.skipHooks){
                hooks[type].emit('postUpdate', resource);
            }
            return resource;
        })
    }

    const del = function (type, id, options) {
      options = options || {};
      const model = models[type]
        return model.findByIdAndRemove(id)
            .then((resource) => {
                if(resource && !options.skipHooks){
                    hooks[type].emit('postDelete', converters.toJsonApi(resource.toObject()));
                }
                return {};
            })
    }

    const processSchema = function (hhSchema) {
        if (!models[hhSchema.type]) {
          hooks[hhSchema.type] = new EventEmitter();
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
        patch,
        delete: del,
        models,
        hooks,
        processSchema
    }

}
