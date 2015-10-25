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
        
        let filterMap = {}
        keys.forEach((key) => {
            filterMap[key] = Joi.string()   
        })
        
        const filter = Joi.object(filterMap)
        const fields = Joi.object({[schema.type] : Joi.string()})
        
        const sortRegex = new RegExp('^-?(' + join + ')(,-?(' + join + '))*$', 'i')
        const sort = Joi.string().regex(sortRegex)
        
        const page = Joi.object({
            limit: Joi.number(),
            offset: Joi.number()
        })
        
        return {include, fields, sort, page, filter}
    }
    
    return { toJoiPostValidatation, toJoiGetQueryValidation }
}