'use strict'

const _ = require('lodash')
const Joi = require('joi')
const Hoek = require('hoek')

module.exports = function() {
    const toJoiPostValidatation = function(schema) {
        return Joi.object().keys({
            data: Joi.object().keys({
                id: Joi.string().regex(/[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89aAbB][a-f0-9]{3}-[a-f0-9]{12}/),
                type: Joi.string().regex(new RegExp(schema.type)).required(),
                attributes: schema.attributes,
                //TODO needs more granular validation once these are implemented
                relationships: Joi.object(),
                links: Joi.object(),
                meta: Joi.object(),
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