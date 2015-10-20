'use strict'

const Hapi = require('hapi')
const _ = require('lodash')
const Hoek = require('hoek')
const mongoose = require('mongoose')
const uuid = require('node-uuid')

module.exports = function() {
    let toJsonApi = function (resources) {
        if (_.isArray(resources)) {
            return _.map(resources, (resource) => {
                return toJsonApiSingle(resource);
            })
        } else {
            return toJsonApiSingle(resources);
        }
    
        function toJsonApiSingle(resource) {
            var mapped = _.mapKeys(resource, function (val, key) {
                if (key === '_id') return 'id'
                else return key
            });
            return _.omit(mapped, '__v')
        }
    }
    
    let toMongooseModel = function (hhSchema) {
    
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
    
        mongooseSchema.attributes =
            _.mapValues(hhSchema.attributes, function (val) {
                Hoek.assert(val.isJoi, 'attribute values in the hh schema should be defined with Joi')
                return schemaMap[val._type]
            })
    
        const schema = mongoose.Schema(mongooseSchema)
        return mongoose.model(hhSchema.type, schema)
    }
    
    let toMongoosePredicate = function(query) {
        const mappedToModel = _.mapKeys(query.filter, function (val, key) {
            if (key == 'id') return '_id'
            else return `attributes.${key}`
        })
    
        return _.mapValues(mappedToModel, function (val, key) {
            if (val.indexOf(',') != -1) return {$in: val.split(',')}
            else return val
        })
    }
    
    return { toJsonApi, toMongooseModel, toMongoosePredicate }
}

