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
        let join = _.keys(schema.attributes).join('|')
        let regex = new RegExp('^(' + join + ')(,(' + join + '))*$', 'i')
        let include = Joi.string().regex(regex)
        return {include}
    }
    
    return { toJoiPostValidatation, toJoiGetQueryValidation }
}