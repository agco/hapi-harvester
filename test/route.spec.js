'use strict'

const _ = require('lodash')
const Joi = require('joi')
const utils = require('./utils')

const schema = {
    brands: {
        type: 'brands',
        attributes: {
            code: Joi.string().min(2).max(10),
            year: Joi.number(),
            series: Joi.number(),
            description: Joi.string()
        }
    }
}

describe('Route syntax sugar', function () {

    beforeEach(function () {
        return utils.buildDefaultServer()
    })

    afterEach(utils.createDefaultServerDestructor())

    it('should register all routes for a schema', function () {

        _.map(harvester.routes.all(schema.brands), (route) => server.route(route))
        assertRoutes([
            ['get', '/brands'],
            ['get', '/brands/{id}'],
            ['get', '/brands/changes/streaming'],
            ['post', '/brands'],
            ['patch', '/brands/{id}'],
            ['delete', '/brands/{id}']
        ], (route)=> {
            expect(route).to.not.be.undefined
        })
    })

    it('should register readonly routes for a schema', function () {
        _.map(harvester.routes.readonly(schema.brands), (route) => server.route(route))

        assertRoutes([
            ['get', '/brands'],
            ['get', '/brands/{id}'],
            ['get', '/brands/changes/streaming']
        ], (route)=> {
            expect(route).to.not.be.undefined
        })

        assertRoutes([
            ['post', '/brands'],
            ['patch', '/brands/{id}'],
            ['delete', '/brands/{id}']
        ], (route)=> {
            expect(route).to.be.undefined
        })

    })

    it('should register immutable routes for a schema', function () {
        _.map(harvester.routes.immutable(schema.brands), (route) => server.route(route))

        assertRoutes([
            ['get', '/brands'],
            ['get', '/brands/{id}'],
            ['get', '/brands/changes/streaming'],
            ['post', '/brands']
        ], (route)=> {
            expect(route).to.not.be.undefined
        })

        assertRoutes([
            ['patch', '/brands/{id}'],
            ['delete', '/brands/{id}']
        ], (route)=> {
            expect(route).to.be.undefined
        })
    })

    it('should register specific routes for a schema', function () {
        _.map(harvester.routes.pick(schema.brands, ['get', 'getById']), (route) => server.route(route))

        assertRoutes([
            ['get', '/brands'],
            ['get', '/brands/{id}']
        ], (route)=> {
            expect(route).to.not.be.undefined
        })

        assertRoutes([
            ['patch', '/brands/{id}'],
            ['delete', '/brands/{id}'],
            ['get', '/brands/changes/streaming'],
            ['post', '/brands']
        ], (route)=> {
            expect(route).to.be.undefined
        })
    })

    it('should register all routes for a schema with options merged', function () {
        _.chain(harvester.routes.all(schema.brands))
            .map((route) => {
                return _.merge(route, {
                    config: {
                        tags: ['mytag']
                    }
                })
            })
            .map((route) =>
                server.route(route)
            )
            .value()

        assertRoutes([
            ['get', '/brands'],
            ['get', '/brands/{id}'],
            ['get', '/brands/changes/streaming'],
            ['post', '/brands'],
            ['patch', '/brands/{id}'],
            ['delete', '/brands/{id}']
        ], (route)=> {
            expect(route.settings.tags[0]).to.equal('mytag')
        })

    })

    it('should register readonly routes for a schema with options merged only for those routes', function () {
        _.chain(harvester.routes.readonly(schema.brands))
            .map((route) => {
                return _.merge(route, {
                    config: {
                        tags: ['mytag']
                    }
                })
            })
            .map((route) =>
                server.route(route)
            )
            .value()

        assertRoutes([
            ['get', '/brands'],
            ['get', '/brands/{id}'],
            ['get', '/brands/changes/streaming']
        ], (route)=> {
            expect(route.settings.tags[0]).to.equal('mytag')
        })

        assertRoutes([
            ['post', '/brands'],
            ['patch', '/brands/{id}'],
            ['delete', '/brands/{id}']
        ], (route)=> {
            expect(route).to.be.undefined
        })

    })

    function assertRoutes(verbPathAssociations, assertFn) {
        _.each(verbPathAssociations, (assoc) => {
            var route = getRoute(assoc[0], assoc[1]);
            assertFn(route)
        })
    }

    function getRoute(verb, path) {
        const table = server.connections[0].table()
        return _.find(table, (item)=> {
            return item.method === verb && item.path === path
        })
    }
})
