'use strict'

const _ = require('lodash')
const Promise = require('bluebird')
const Joi = require('joi')
const utils = require('./utils');
const uuid = require('node-uuid')
const seeder = require('./seeder');

const schema = {
    brands: {
        type: 'brands',
        attributes: {
            code: Joi.string().required().min(2).max(10),
            description: Joi.string().required()
        }
    }
};

const data = {
    type: 'brands',
    attributes: {
        code: 'MF',
        description: 'Massey Furgeson'
    }
};

describe('Rest operations when things go right', function() {

    before(function () {
        return utils.buildDefaultServer(schema).then(function (server) {
            return seeder(server).dropCollections('brands');
        });
    });

    after(utils.createDefaultServerDestructor());

    it('should set the content-type header to application/json by default', function() {
        return server.injectThen({method: 'GET', url: '/brands'})
        .then((res) => {
            expect(res.headers['content-type']).to.equal('application/json; charset=utf-8')
        })
    })

    it('should allow all request with content-type set to application/json', function() {
        const headers = {
            'content-type' : 'application/json'
        }

        server.injectThen({method: 'post', url: '/brands', headers: headers, payload: {data}})
            .then((res) => {
                expect(res.statusCode).to.equal(201)
            })
    })

    it('should allow all request with content-type set to application/vnd.api+json', function() {
        const headers = {
            'content-type' : 'application/vnd.api+json'
        }

        server.injectThen({method: 'post', url: '/brands', headers: headers, payload: {data}})

            .then((res) => {
                expect(res.statusCode).to.equal(201)
            })
    })

    it('Will be able to GET by id from /brands', function() {
        return server.injectThen({method: 'post', url: '/brands', payload: {data}})
        .then((res) => {
            return server.injectThen({method: 'get', url: '/brands/' + res.result.data.id})
        })
        .then((res) => {
            expect(res.result.data.id).to.match(/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/)
            expect(utils.getData(res)).to.deep.equal(data)
        })
    })

    it('Will be able to GET all from /brands', function() {
        let promises = [];

        _.times(10, () => {
            promises.push(server.injectThen({method: 'post', url: '/brands', payload: {data}}))
        })

        return Promise.all(promises)
        .then(() => {
            return server.injectThen({method: 'get', url: '/brands'})
        })
        .then((res) => {
            res.result.data.forEach((data) => {
                expect(data.id).to.match(/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/)
                expect(data).to.deep.equal(data)
            })
        })
    })

    it('Will be able to POST to /brands', function() {
        let payload = _.cloneDeep(data)
        payload.id = uuid.v4()

        return server.injectThen({method: 'post', url: '/brands', payload: {data}}).then((res) => {
            expect(res.result.data.id).to.match(/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/)
            expect(utils.getData(res)).to.deep.equal(data)
        })
    })

    it('Will be able to POST to /brands with uuid', function() {
        return server.injectThen({method: 'post', url: '/brands', payload: {data}}).then((res) => {
            expect(res.result.data.id).to.match(/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/)
            expect(utils.getData(res)).to.deep.equal(data)
        })
    })

    it('Will be able to PATCH in /brands', function() {
        const payload = {
            attributes: {
                code: 'VT'
            }
        };
        const expected = {
            type: 'brands',
            attributes: {
                code: 'VT',
                description: 'Massey Furgeson'
            }
        };
        return server.injectThen({method: 'post', url: '/brands', payload: {data}})
        .then((res) => {
            return server.injectThen({method: 'patch', url: '/brands/' + res.result.data.id, payload: {data : payload}})
        })
        .then((res) => {
            expect(res.result.data.id).to.match(/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/)
            expect(utils.getData(res)).to.deep.equal(expected)
        })
    })

    it('Will be able to DELETE in /brands', function() {
        return server.injectThen({method: 'post', url: '/brands', payload: {data}})
        .then((res) => {
            return server.injectThen({method: 'delete', url: '/brands/' + res.result.data.id})
        })
        .then((res) => {
            expect(res.statusCode).to.equal(204)
        })
    })
})

describe('Rest operations when things go wrong', function() {

    before(function () {
        return utils.buildDefaultServer(schema);
    });

    after(utils.createDefaultServerDestructor());

    it('should reject all request with content-type not set to application/json or application/vnd.api+json', function() {

        const headers = {
            'content-type' : 'text/html'
        }

       return server.injectThen({method: 'post', url: '/brands', headers : headers}).then((res) => {
            expect(res.statusCode).to.equal(415)
        })
    })

    it('Won\'t be able to POST to /brands with a payload that doesn\'t match the schema', function() {

        let payload = _.cloneDeep(data);
        payload.foo = 'bar'

        return server.injectThen({method: 'post', url: '/brands', payload: {data: payload}}).then((res) => {
            expect(res.statusCode).to.equal(400)
        })
    })

    it('Won\'t be able to POST to /brands when data is missing', function () {
        return server.injectThen({method: 'post', url: '/brands', payload: {}}).then((res) => {
            expect(res.statusCode).to.equal(400)
            const body = JSON.parse(res.payload)
            expect(body.errors).to.have.length(1)
            expect(body.errors[0]).to.have.deep.property('validation.keys')
            expect(body.errors[0].validation.keys).to.include('data')
        })
    })

    it('Won\'t be able to POST to /brands with a payload that doesn\'t have a type property', function() {

        let payload = _.cloneDeep(data);
        delete payload.type

        return server.injectThen({method: 'post', url: '/brands', payload: {data: payload}}).then((res) => {
            expect(res.statusCode).to.equal(400)
        })
    })

    it('Won\'t be able to POST to /brands with an invalid uuid', function() {

        let payload = _.cloneDeep(data);
        // has to match this /[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89aAbB][a-f0-9]{3}-[a-f0-9]{12}
        payload.id = '54ce70cd-9d0e-98e8-89c2-1423affcb0ca'

        return server.injectThen({method: 'post', url: '/brands', payload: {data: payload}}).then((res) => {
            expect(res.statusCode).to.equal(400)
        })
    })

    it('Won\'t be able to POST to /brands with an invalid type', function() {

        let payload = _.cloneDeep(data);
        payload.type = 'zonk'

        return server.injectThen({method: 'post', url: '/brands', payload: {data: payload}}).then((res) => {
            expect(res.statusCode).to.equal(400)
        })
    })

    it('Won\'t be able to POST to /brands with without type', function() {

        let payload = _.cloneDeep(data);
        delete payload.type

        return server.injectThen({method: 'post', url: '/brands', payload: {data: payload}}).then((res) => {
            expect(res.statusCode).to.equal(400)
        })
    })

    it('Won\'t be able to POST to /brands with a payload that has attributes that don\'t match the schema', function() {

        let payload = _.cloneDeep(data);
        payload.attributes.foo = 'bar'

        return server.injectThen({method: 'post', url: '/brands', payload: {data: payload}}).then((res) => {
            expect(res.statusCode).to.equal(400)
        })
    })

    it('Won\'t be able to GET by id from /brands if id is wrong', function() {
        return server.injectThen({method: 'post', url: '/brands', payload: {data}})
        .then(() => {
            return server.injectThen({method: 'get', url: '/brands/2658b978-88db-4bb8-81bc-b005bf5c4bc4'})
        })
        .then((res) => {
            expect(res.statusCode).to.equal(404)
        })
    })

    it('Won\'t be able to PATCH in /brands with wrong id', function() {
        const payload = {
            type: 'brands',
            attributes: {
                code: 'VT',
                description: 'Valtra'
            }
        };
        return server.injectThen({method: 'post', url: '/brands', payload: {data}})
        .then(() => {
            return server.injectThen({method: 'patch', url: '/brands/2658b978-88db-4bb8-81bc-b005bf5c4bc4', payload: {data : payload}})
        })
        .then((res) => {
            expect(res.statusCode).to.equal(404)
        })
    })
})
