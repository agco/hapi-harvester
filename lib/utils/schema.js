'use strict'

const _ = require('lodash')
const Joi = require('joi')
const Hoek = require('hoek')

module.exports = function() {
    let toJoiPostValidatation = function(schema) {
        return Joi.object().keys({
            data: Joi.object().keys({
                attributes : schema.attributes
            })
        })
    }
    
    let toJoiGetQueryValidation = function(schema) {
        let keys = _.keys(schema.attributes);
        let join = keys.join('|')
        
        let regex = new RegExp('^(' + join + ')(,(' + join + '))*$', 'i')
        let include = Joi.string().regex(regex)
        
        let fieldMap = {}
        keys.forEach((key) => {
            fieldMap[key] = Joi.string()   
        })
        let fields = Joi.object(fieldMap)
        
        let sort = Joi.string().regex(regex)
        
        let page = Joi.object({
            limit: Joi.number(),
            offset: Joi.number()
        })
        
        return {include, fields, sort, page}
    }
    
    return { toJoiPostValidatation, toJoiGetQueryValidation }
}