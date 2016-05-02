'use strict'

const _ = require('lodash')
const Joi = require('joi')

const idPattern = /[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89aAbB][a-f0-9]{3}-[a-f0-9]{12,13}/
const idDescription = 'RFC4122 v4 UUID'

module.exports = function () {
    const toJoiPostValidatation = function (schema, patch) {
        const relationshipsScheme = {};
        _.forEach(schema.relationships, function (item, key) {
            const isArray = _.isArray(item.data);
            const itemSchemaType = isArray ? item.data[0].type : item.data.type;
            const itemSchema = {
                id: Joi.string().required().regex(idPattern).description(idDescription),
                type: Joi.string().required().valid(itemSchemaType)
            }
            relationshipsScheme[key] = Joi.object().keys({
              data: isArray ? Joi.array().items(itemSchema) : Joi.object().keys(itemSchema)
            });
        });
        let dataType = Joi.string().valid(schema.type).required();
        if (patch) {
            schema.attributes = convertPostValidationToPatch(schema.attributes);
            dataType = Joi.string().valid(schema.type);
        }
        return Joi.object().keys({
            data: Joi.object().keys({
                id: Joi.string().regex(idPattern).description(idDescription),
                type: dataType,
                attributes: schema.attributes,
                relationships: relationshipsScheme
            }).required()
        })
    }

    const convertPostValidationToPatch = function (attributes) {
        Object.keys(attributes).forEach(function(s) {
            if (s && attributes[s] && attributes[s].isJoi && attributes[s]._flags && attributes[s]._flags.presence) {
                attributes[s]._flags.presence = 'optional';
            }
        });
        return attributes;
    }

    const createSingleRelationToPostPatch = function (type) {
        return Joi.object({
            id: Joi.string().regex(idPattern).required().description(idDescription),
            type: Joi.string().valid(type).required()
        });
    }

    const toJoiPostRelationshipsValidatation = function (type, isArray) {
        return Joi.object().keys({
            data: isArray ? Joi.array().items(createSingleRelationToPostPatch(type)).required() : createSingleRelationToPostPatch(type).required()
        })
    }

    const toJoiPatchRelationshipsValidatation = function (type, isArray) {
        return Joi.object().keys({
            data: isArray ? Joi.array().items(createSingleRelationToPostPatch(type)).required() : Joi.alternatives()
                .try(null, createSingleRelationToPostPatch(type))
                .required()
        })
    }

    const toJoiGetQueryValidation = function (schema) {
        const keys = _.union(['id'], _.keys(schema.attributes), _.keys(schema.relationships));
        const join = keys.join('|')

        const include = Joi.string();

        let filterMap = {}
        keys.forEach((key) => {
            filterMap[key] = Joi.alternatives()
                .try(Joi.array().items(Joi.string()), Joi.string())
        })

        const filter = Joi.object(filterMap)
        const fields = Joi.object({}).pattern(/.*/, Joi.string())

        //TODO how about 'allow' instead 'regexp'?
        const sortRegex = new RegExp('^-?(' + join + ')(,-?(' + join + '))*$', 'i')
        const sort = Joi.string().regex(sortRegex)

        const page = Joi.object({
            limit: Joi.number(),
            offset: Joi.number()
        })

        return {include, fields, sort, page, filter}
    }

    const toJoiGetByIdPathValidation = function () {

        const id = Joi.string().regex(idPattern).required().description(idDescription)

        return {id}
    }

    const toJoiGetMultiSSEQueryValidation = function () {
        const resources = Joi.string().required()
        return {resources}
    }

    return {
        toJoiPostValidatation,
        toJoiPostRelationshipsValidatation,
        toJoiGetQueryValidation,
        toJoiGetByIdPathValidation,
        toJoiPatchRelationshipsValidatation,
        toJoiGetMultiSSEQueryValidation
    }
}
