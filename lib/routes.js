'use strict'

const _ = require('lodash');
const schemaUtils = require('./utils/schema')()

module.exports = function () {

    const get = function (schema) {
        return {
            method: 'GET',
            path: `/${schema.type}`,
            config: {
                tags: ['api'],
                validate: {
                    query: schemaUtils.toJoiGetQueryValidation(schema)
                }
            }
        }
    }

    const getById = function (schema) {
        return {
            method: 'GET',
            path: `/${schema.type}/{id}`,
            config: {
                tags: ['api'],
                validate: {
                    params: schemaUtils.toJoiGetByIdPathValidation()
                }
            }
        }
    }

    const getByIdRelationships = function (parentSchema, relationshipName) {
        return {
            method: 'GET',
            path: `/${parentSchema.type}/{id}/relationships/${relationshipName}`,
            config: {
                tags: ['api'],
                validate: {
                    params: schemaUtils.toJoiGetByIdPathValidation()
                }
            }
        }
    }

    const patchByIdRelationships = function (parentSchema, relationshipName) {
        const relationship = parentSchema.relationships[relationshipName].data
        const isRelationshipArray = _.isArray(relationship);
        const relationshipSchemaType = isRelationshipArray ? relationship[0].type : relationship.type
        return {
            method: 'PATCH',
            path: `/${parentSchema.type}/{id}/relationships/${relationshipName}`,
            config: {
                tags: ['api'],
                validate: {
                    params: schemaUtils.toJoiGetByIdPathValidation(),
                    payload: schemaUtils.toJoiPatchRelationshipsValidatation(relationshipSchemaType, isRelationshipArray)
                },
                payload: {
                    allow: ['application/json', 'application/vnd.api+json']
                }
            }
        }
    }

    const postByIdRelationships = function (parentSchema, relationshipName) {
        const relationship = parentSchema.relationships[relationshipName].data
        const isRelationshipArray = _.isArray(relationship);
        const relationshipSchemaType = isRelationshipArray ? relationship[0].type : relationship.type
        return {
            method: 'POST',
            path: `/${parentSchema.type}/{id}/relationships/${relationshipName}`,
            config: {
                tags: ['api'],
                validate: {
                    params: schemaUtils.toJoiGetByIdPathValidation(),
                    payload: schemaUtils.toJoiPostRelationshipsValidatation(relationshipSchemaType, isRelationshipArray)
                },
                payload: {
                    allow: ['application/json', 'application/vnd.api+json']
                }
            }
        }
    }

    const deleteByIdRelationships = function (parentSchema, relationshipName) {
        return {
            method: 'DELETE',
            path: `/${parentSchema.type}/{id}/relationships/${relationshipName}`,
            config: {
                tags: ['api'],
                validate: {
                    params: schemaUtils.toJoiGetByIdPathValidation()
                }
            }
        }
    }

    const getChangesStreaming = function (schema) {
        if (schema == null) {
            return {
                method: 'get',
                path: '/changes/streaming',
                config: {
                    tags: ['api'],
                    validate: {
                        query: schemaUtils.toJoiGetMultiSSEQueryValidation()
                    }
                }
            }
        }
        return {
            method: 'GET',
            path: `/${schema.type}/changes/streaming`,
            config: {
                tags: ['api']
            }
        }
    }

    const post = function (schema) {
        return {
            method: 'POST',
            path: `/${schema.type}`,
            config: {
                tags: ['api'],
                payload: {
                    allow: ['application/json', 'application/vnd.api+json']
                },
                validate: {
                    payload: schemaUtils.toJoiPostValidatation(schema)
                }
            }
        }
    }

    const patch = function (schema) {
        return {
            method: 'PATCH',
            path: `/${schema.type}/{id}`,
            config: {
                tags: ['api'],
                payload: {
                    allow: 'application/json'
                },
                validate: {
                    params: schemaUtils.toJoiGetByIdPathValidation(),
                    payload: schemaUtils.toJoiPostValidatation(schema)
                }
            }
        }
    }

    const del = function (schema) {
        return {
            method: 'DELETE',
            path: `/${schema.type}/{id}`,
            config: {
                tags: ['api'],
                validate: {
                    params: schemaUtils.toJoiGetByIdPathValidation()
                }
            }
        }
    }

    const options = function (schema) {
        return {
            method: 'OPTIONS',
            path: `/${schema.type}`
        }
    }

    return {
        get: get,
        getById,
        getByIdRelationships,
        patchByIdRelationships,
        postByIdRelationships,
        deleteByIdRelationships,
        getChangesStreaming,
        post,
        patch,
        delete: del,
        options
    }

}
