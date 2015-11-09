'use strict'

const Hapi = require('hapi')
const _ = require('lodash')
const Hoek = require('hoek')
const mongoose = require('mongoose')
const uuid = require('node-uuid')

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
            var mapped = _.mapKeys(resource, function (val, key) {
                if (key === '_id') return 'id'
                else return key
            });
            return _.omit(mapped, '__v')
        }
    }
    
    const toMongooseModel = function (hhSchema) {
    
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
            _.mapValues(hhSchema.attributes, function (val) {
                Hoek.assert(val.isJoi, 'attribute values in the hh schema should be defined with Joi')
                return schemaMap[val._type]
            })
        mongooseSchema.relationships =
            _.mapValues(hhSchema.relationships, function (val) {
                return _.isArray(val) ? Array : Object;
            });

        const schema = mongoose.Schema(mongooseSchema)
        return mongoose.model(hhSchema.type, schema)
    }
    
    const toMongoosePredicate = function(query) {
        const mappedToModel = _.mapKeys(query.filter, function (val, key) {
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
            const valueKey = _.keys(val)[0]
            if (_.contains(supportedComparators, valueKey)) {
                return {[`$${valueKey}`] : val[valueKey]}
            }
            
            else return val
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

