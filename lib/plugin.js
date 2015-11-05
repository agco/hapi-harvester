'use strict'

const _ = require('lodash')
const routes = require('./routes')()
const adapterUtils = require('./utils/adapter')()
const routeUtils = require('./utils/route')()
const includes = require('./includes');

// constants
const MIME = {
    standard: ['application/vnd.api+json', 'application/json'],
    patch: ['application/json-patch+json']
};

exports.register = function (server, opts, next) {
    server.expose('version', require('../package.json').version);
    
    const adapter = opts.adapter;
    const schemas = {};

    adapterUtils.checkValidAdapter(adapter);
    
    adapter.connect(() => {
        server.expose('adapter', adapter);
        next()
    });

    /*
     * Get associations from a schema.
     *
     * @api private
     * @param {Object} schema
     * @return {Array}
     */
    function getAssociations(schema) {
        var associations = [];

        _.each(schema, function (value, key) {
            var singular = !_.isArray(value);
            var type = !singular ? value[0] : value;

            type = _.isPlainObject(type) ? type.ref : type;

            if (typeof type === 'string') {
                associations.push({key: key, type: type, singular: singular});
            }
        });

        return associations;
    }

    function appendLinkForKey(body, key) {
        var schema = schemas[key];
        var associations = getAssociations(schema);

        if (!associations.length) {
            return;
        }
        body.links = body.links || {};
        associations.forEach(function (association) {
            var name = [key, association.key].join('.');

            body.links[name] = {
                href: opts.baseUrl + '/' +
                    //(!!namespace ? namespace + '/' : '') +
                association.type + '/{' + name + '}',
                type: association.type
            };
        });
    }

    function appendLinks(body) {
        _.each(body, function (value, key) {
            if (key === 'meta') {
                return;
            }
            if (key === 'linked') {
                _.each(value, function (val, k) {
                    appendLinkForKey(body, k);
                });

            } else {
                appendLinkForKey(body, key);
            }
        });
        return body;
    }

    const appendLinked = includes(adapter, schemas).linked;

    function sendResponse(type, req, reply, status, object) {
        if (status === 204) {
            reply().code(status);
            return;
        }

        object = object || {};

        var finishSending = function (object) {
            object = appendLinks(object);

            // web browser check
            reply(object)
                .code(status)
                .header('Content-Type', (req.headers['user-agent'] || '').indexOf('Mozilla') === 0 ?
                    MIME.standard[0] : MIME.standard[1]);
        };

        if (req.query.include) {
            appendLinked(object, type, req.query.include.split(','))
                .then(finishSending)
                .catch(function (error) {
                    console.log(error.stack);
                    sendError(req, reply, error);
                });
        } else {
            finishSending(object);
        }
    }

    const get = function (schema) {
        routeUtils.createOptionsRoute(server, schema)
        adapter.processSchema(schema)
        schemas[schema.type] = schema
        return _.merge(routes.get(schema), {
            handler: (req, reply) => {
                routeUtils.parseComparators(req)
                if (_.isString(req.query.fields)) {
                    let fields = req.query.fields;
                    req.query.fields = {};
                    req.query.fields[schema.type] = fields;
                }
                adapter.find(schema.type, req).then(function (object) {
                    sendResponse(schema.type, req, reply, 200, object)
                });
            }
        })
    }
    
    const getById = function (schema) {
        routeUtils.createOptionsRoute(server, schema)
        adapter.processSchema(schema)
        return _.merge(routes.getById(schema), {
            handler: (req, reply) => {
                reply(adapter.findById(schema.type, req))
            }
        })
    }
    
    const post = function (schema) {
        routeUtils.createOptionsRoute(server, schema)
        adapter.processSchema(schema)
        return _.merge(routes.post(schema), {
            handler: (req, reply) => {
                reply(adapter.create(schema.type, req)).code(201)
            }
        })
    }
    
    const patch = function (schema) {
        routeUtils.createOptionsRoute(server, schema)
        adapter.processSchema(schema)
        return _.merge(routes.patch(schema), {
            handler: (req, reply) => {
                reply(adapter.update(schema.type, req))
            }
        })
    }
    
    const del = function (schema) {
        routeUtils.createOptionsRoute(server, schema)
        adapter.processSchema(schema)
        return _.merge(routes.delete(schema), {
            handler: (req, reply) => {
                reply(adapter.delete(schema.type, req)).code(204)
            }
        })
    }
    
    server.expose('routes', {
        get: get,
        getById: getById,
        post: post,
        patch: patch,
        delete: del
    })

    server.expose('schemas', schemas);

    server.ext('onPostStop', (server, next) => {
        adapter.disconnect(next)
    })
}

exports.register.attributes = {
    pkg: require('../package.json')
}

exports.getAdapter = adapterUtils.getStandardAdapter;
