'use strict'

const Hapi = require('hapi')
const _ = require('lodash')
const Hoek = require('hoek')
const uuid = require('node-uuid')
const mongoose = require('mongoose')

module.exports = function() {
    const toJsonApi = function (resources) {
        if (_.isArray(resources)) {
            return _.map(resources, (resource) => {
                return toJsonApiSingle(resource);
            })
        } else {
            return toJsonApiSingle(resources);
        }

        function toJsonApiSingle(resource) {
            return _.chain(resource)
                .thru(_idToId)
                .omit('__v')
                .value();

            function _idToId(resource) {
                if (resource._id) {
                    resource.id = resource._id;
                    delete resource._id;
                }
                return resource;
            }
        }
    }

    const toMongooseModel = function (db, hhSchema) {

        const mongooseSchema = {}
        mongooseSchema._id = {
            type: String,
            default: () => {
                return uuid.v4()
            }
        }

        var schemaMap = {
            'string': String,
            'number': Number,
            'date': Date,
            'buffer': Buffer,
            'boolean': Boolean,
            'array': Array,
            'any': Object
        }

        mongooseSchema.type = 'string'
        mongooseSchema.attributes =
            _.mapValues(hhSchema.attributes, function (val, key) {
                Hoek.assert(val.isJoi, 'attribute values in the hh schema should be defined with Joi')
                if (key === 'type') {
                    return {type: schemaMap[val._type]}
                }
                return schemaMap[val._type]
            })
        mongooseSchema.relationships =
            _.mapValues(hhSchema.relationships, function (val) {
                return _.isArray(val.data) ? {data: Array} : {data: Object};
            });

        const schema = mongoose.Schema(mongooseSchema);
        return db.model(hhSchema.type, schema)
    }

    const toMongoosePredicate = function(filter) {
        const mappedToModel = _.mapKeys(filter, function (val, key) {
            if (key === 'id') return '_id'
            else return `attributes.${key}`
        })

        return _.mapValues(mappedToModel, function (val, key) {
            const supportedComparators = ['lt', 'lte', 'gt', 'gte']

            //if it's a normal value strig, do a $in query
            if (_.isString(val) && val.indexOf(',') !== -1) {
                return {$in: val.split(',')}
            }

            //if it's a comparator, translate to $gt, $lt etc
            _.forEach(val, function (value, key) {
                if (_.contains(supportedComparators, key)) {
                    val[`$${key}`] = value
                    delete val[key]
                }
            })
            return val
        })
    }

    const toMongooseSort = function(sort) {
        if (!sort) return {'_id' : -1}
        if(sort.indexOf('-') === 0) {
            return {[`attributes.${sort.substr(1)}`] : -1}
        }

        return {[`attributes.${sort}`] : 1}
    }

    return { toJsonApi, toMongooseModel, toMongoosePredicate, toMongooseSort }
}
