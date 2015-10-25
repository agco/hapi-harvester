'use strict'

const _ = require('lodash')
const Promise = require('bluebird')
const Joi = require('joi')
const Hapi = require('hapi')

let server, buildServer, destroyServer, hh;

const schema = {
    type: 'brands',
    attributes: {
        code: Joi.string().min(2).max(10),
        year: Joi.number(),
        series: Joi.number(),
        description: Joi.string()
    }
};

const data = {
    type: 'brands',
    attributes: {
        code: 'MF',
        year: 2007,
        series: 5,
        description: 'Massey Furgeson'
    }
};


//TODO just done the validation, actual includes is remaining
describe('Filtering', function() {
    
    beforeEach(function(done) {
        buildServer(() => {
            let promises = [];
        
            _.times(10, (index) => {
                let payload = Object.assign({}, data)
                payload.attributes.year = 2000 + index;
                payload.attributes.series = 0 + index;
                promises.push(server.injectThen({method: 'post', url: '/brands', payload: {data : payload}}))
            })
            
            return Promise.all(promises)
            .then(() => {
                done()
            })
        })
    })
    
    afterEach(function(done) {
        destroyServer(done)
    })
    
    it('Will be able to GET all from /brands with a equal filtering param', function() {
        return server.injectThen({method: 'get', url: '/brands?filter[year]=2007'})
        .then((res) => {
            expect(res.result.data).to.have.length(1)
            expect(res.result.data[0].attributes).to.deep.equal({
                code: 'MF',
                year: 2007,
                series: 7,
                description: 'Massey Furgeson'
            })
        })
    })
    
    it('Will be able to GET all from /brands with a "greater than" comparator filtering param', function() {
        return server.injectThen({method: 'get', url: '/brands?filter[year]=gt=2005'})
        .then((res) => {
            expect(res.result.data).to.have.length(4)
            
            var expectedResponses = _.times(4, (index) => {
                return {
                    code: 'MF',
                    year: 2006 + index,
                    series: 6 + index,
                    description: 'Massey Furgeson'
                }
            })
            
            res.result.data.forEach((data, index) => {
                expect(data.id).to.match(/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/)
                expect(expectedResponses).to.include.something.that.deep.equals(data.attributes)
            })
        })
    })
    
    it('Will be able to GET all from /brands with a "greater than equal" comparator filtering param', function() {
        return server.injectThen({method: 'get', url: '/brands?filter[year]=gte=2005'})
        .then((res) => {
            expect(res.result.data).to.have.length(5)
            
            var expectedResponses = _.times(5, (index) => {
                return {
                    code: 'MF',
                    year: 2005 + index,
                    series: 5 + index,
                    description: 'Massey Furgeson'
                }
            })
            
            res.result.data.forEach((data, index) => {
                expect(data.id).to.match(/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/)
                expect(expectedResponses).to.include.something.that.deep.equals(data.attributes)
            })
        })
    })
    
    it('Will be able to GET all from /brands with a "less than" comparator filtering param', function() {
        return server.injectThen({method: 'get', url: '/brands?filter[year]=lt=2005'})
        .then((res) => {
            expect(res.result.data).to.have.length(5)
            
            var expectedResponses = _.times(5, (index) => {
                return {
                    code: 'MF',
                    year: 2004 - index,
                    series: 4 - index,
                    description: 'Massey Furgeson'
                }
            })
            
            res.result.data.forEach((data, index) => {
                expect(data.id).to.match(/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/)
                expect(expectedResponses).to.include.something.that.deep.equals(data.attributes)
            })
        })
    })
    
    it('Will be able to GET all from /brands with a "less than equal" comparator filtering param', function() {
        return server.injectThen({method: 'get', url: '/brands?filter[year]=lte=2005'})
        .then((res) => {
            expect(res.result.data).to.have.length(6)
            
            var expectedResponses = _.times(6, (index) => {
                return {
                    code: 'MF',
                    year: 2005 - index,
                    series: 5 - index,
                    description: 'Massey Furgeson'
                }
            })
            
            res.result.data.forEach((data, index) => {
                expect(data.id).to.match(/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/)
                expect(expectedResponses).to.include.something.that.deep.equals(data.attributes)
            })
        })
    })
    
    it('Will be able to GET all from /brands with a combination of comparator filtering params', function() {
        return server.injectThen({method: 'get', url: '/brands?filter[year]=lte=2005&filter[series]=gte=3'})
        .then((res) => {
            expect(res.result.data).to.have.length(3)
            
            var expectedResponses = _.times(3, (index) => {
                return {
                    code: 'MF',
                    year: 2005 - index,
                    series: 5 - index,
                    description: 'Massey Furgeson'
                }
            })
            
            res.result.data.forEach((data, index) => {
                expect(data.id).to.match(/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/)
                expect(expectedResponses).to.include.something.that.deep.equals(data.attributes)
            })
        })
    })
    
    it('Will be able to GET all from /brands with a combination of comparator and equal filtering params', function() {
        return server.injectThen({method: 'get', url: '/brands?filter[year]=lte=2005&filter[series]=3'})
        .then((res) => {
            expect(res.result.data).to.have.length(1)
            
            expect(res.result.data[0].attributes).to.deep.equal({
                code: 'MF',
                year: 2003,
                series: 3,
                description: 'Massey Furgeson'
            })
        })
    })
    
    it('Will be able to GET all from /brands with multiple filtering params', function() {
        return server.injectThen({method: 'get', url: '/brands?filter[year]=lt=2010&filter[series]=gt=2'})
        .then((res) => {
            res.result.data.forEach((data) => {
                expect(data.id).to.match(/[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}/)
                expect(data).to.deep.equal(data)
            })
        })
    })
    
    it('Won\'t be able to GET all from /brands with multiple filtering params where one is not available in attributes', function() {
        
        return server.injectThen({method: 'get', url: '/brands?filter[foo]=ge=2007&filter[year]=gt=2000'})
        .then((res) => {
            expect(res.statusCode).to.equal(400)  
        })
    })
})

buildServer = function(done) {
    return utils.buildServer(schema)
        .then((res) => {
            server = res.server;
            hh = res.hh;
            done()
        })
}

destroyServer = function(done) {
    utils.removeFromDB(server, 'brands')
    .then((res) => {
        server.stop(done)  
    })
}