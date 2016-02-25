'use strict'

const utils = require('./utils');
const seeder = require('./seeder');
const _ = require('lodash');

const schema = {
    brands: {
        type: 'brands',
        attributes: {}
    }
};

describe('Onbefore', function () {

    before(function () {
        return utils.buildDefaultServer().then(function () {
            _.chain(harvester.routes.all(schema.brands))
                .map((route)=> {
                        return _.merge(route,
                            {
                                config: {
                                    ext: {
                                        onPreHandler: {
                                            method(req, reply) {
                                                let code = 404;
                                                if (req.method === 'get') {
                                                    if (req.params.id) {
                                                        code = 124;
                                                    } else {
                                                        code = 123
                                                    }
                                                } else if (req.method === 'post') {
                                                    code = 125;
                                                } else if (req.method === 'patch') {
                                                    code = 126;
                                                } else if (req.method === 'delete') {
                                                    code = 127;
                                                }
                                                reply().code(code);
                                            }
                                        }
                                    }
                                }
                            })
                    }
                )
                .map((route) => server.route(route))
                .value()
        })
    });

    after(utils.createDefaultServerDestructor());

    it('should respond with 123 on GET /brands', function () {
        return server.injectThen({method: 'get', url: '/brands'}).then((res) => {
            expect(res.statusCode).to.equal(123)
        })
    })
    it('should respond with 124 on GET /brands/1', function () {
        return server.injectThen({method: 'get', url: '/brands/2658b978-88db-4bb8-81bc-b005bf5c4bc4'}).then((res) => {
            expect(res.statusCode).to.equal(124)
        })
    })
    it('should respond with 125 on POST /brands', function () {
        return server.injectThen({method: 'post', url: '/brands', payload: {data: {type: 'brands'}}}).then((res) => {
            expect(res.statusCode).to.equal(125)
        })
    })
    it('should respond with 126 on PATCH /brands', function () {
        return server.injectThen({
            method: 'patch',
            url: '/brands/2658b978-88db-4bb8-81bc-b005bf5c4bc4',
            payload: {data: {type: 'brands'}}
        }).then((res) => {
            expect(res.statusCode).to.equal(126)
        })
    })
    it('should respond with 127 on DELETE /brands', function () {
        return server.injectThen({
            method: 'delete',
            url: '/brands/2658b978-88db-4bb8-81bc-b005bf5c4bc4',
            payload: {}
        }).then((res) => {
            expect(res.statusCode).to.equal(127)
        })
    })

})
