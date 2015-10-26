'use strict'

const _ = require('lodash')
const routes = require('../routes')()

module.exports = function() {
    const createOptionsRoute = function(server, schema) {
        const tables = _.map(server.table()[0].table)
        
        //see if the options method already exists, if so, don't duplicate it
        if (_.find(tables, {path : '/' + schema.type, method: 'options'})) return;
        
        server.route(_.merge(routes.options(schema), {
            handler: (req, reply) => {
                const tables = _.map(req.server.table()[0].table, (table) => {
                    return _.pick(table, 'path', 'method')
                })
                
                const pathVerbs = _.chain(tables)
                .filter((table) => {
                    return table.path.replace('/{id}', '') === req.path 
                })
                .pluck('method')
                .map((verb) => { return verb.toUpperCase() })
                .value();
                
                reply().header('Allow', pathVerbs.join(','))
            }
        }))
    }
    
    const parseComparators = function(req) {
        const supportedComparators = ['lt', 'lte', 'gt', 'gte']
        
        req.query.filter && _.each(req.query.filter, (filter, key) => {
            const split = filter.split('=')
            
            if (split.length > 1 &&  _.contains(supportedComparators, split[0])) {
                req.query.filter[key] = {[split[0]] : split[1]}
            }
        })
        
        return req
    }
    
    return { createOptionsRoute, parseComparators }
}