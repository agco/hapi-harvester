'use strict'

const _ = require('lodash')
const Joi = require('joi')
const Hoek = require('hoek')

module.exports = function() {
    const toJoiPostValidatation = function(schema) {
        return Joi.object().keys({
            data: Joi.object().keys({
                attributes : schema.attributes
            })
        })
    }
    
    const toJoiGetQueryValidation = function(schema) {
        const keys = _.keys(schema.attributes);
        const join = keys.join('|')
        
        const regex = new RegExp('^(' + join + ')(,(' + join + '))*$', 'i')
        const include = Joi.string().regex(regex)
        
        const fieldMap = {}
        keys.forEach((key) => {
            fieldMap[key] = Joi.string()   
        })
        
        const fields = Joi.object(fieldMap)
        
        const sort = Joi.string().regex(regex)
        
        const page = Joi.object({
            limit: Joi.number(),
            offset: Joi.number()
        })
        
        return {include, fields, sort, page}
    }
    
    return { toJoiPostValidatation, toJoiGetQueryValidation }
}