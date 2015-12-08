'use strict'

const _ = require('lodash')
const Promise = require('bluebird')
var ess = require('agco-event-source-stream')
const Joi = require('joi')
const utils = require('./utils')
const seeder = require('./seeder')
const $http = require('http-as-promised')
const sse = require('../lib/sse')


describe('SSE', function () {

    describe('Single resource', function () {

        const schema = {
            brands: {
                type: 'books',
                attributes: {
                    title: Joi.string(),
                    author: Joi.string()
                }
            },
            superHeros: {
                type: 'superHeros',
                attributes: {
                    timestamp: Joi.number()
                }
            },
            dvds: {
                type: 'dvds',
                attributes: {
                    title: Joi.number()
                }
            }
        }

        let baseUrl
        let lastEventId

        this.timeout(5000)

        before(function () {
            baseUrl = 'http://localhost:9100'
            return utils.buildDefaultServer(schema)
        })

        after(utils.createDefaultServerDestructor())

        describe('When I post to the newly created resource', function () {
            it('Then I should receive a change event with data but not the one before it', function (done) {
                    var eventSource = ess(baseUrl + '/books/changes/streaming', {retry: false})
                        .on('data', function (res) {
                            lastEventId = res.id
                            let data = JSON.parse(res.data)
                            //ignore ticker data
                            if (_.isNumber(data)) {
                                //post data after we've hooked into change events and receive a ticker
                                return seeder(server).dropCollectionsAndSeed({
                                    books: [
                                        {
                                            type: 'books',
                                            attributes: {
                                                title: 'test title 2'
                                            }
                                        }
                                    ]
                                })
                            }
                            const expectedData = {
                                type: 'books',
                                attributes: {
                                    title: 'test title 2'
                                }
                            }
                            expect(res.event.trim()).to.equal('books_i')
                            expect(_.omit(data, 'id')).to.deep.equal(expectedData)
                            done()
                            eventSource.destroy()
                        })
                }
            )
        })

        describe('When I post resource with uppercased characters in name', function () {
            it('Then I should receive a change event', function (done) {
                    var eventSource = ess(baseUrl + '/superHeros/changes/streaming', {retry: false})
                        .on('data', function (data) {
                            data = JSON.parse(data.data)
                            expect(_.omit(data, 'id', 'type')).to.deep.equal({attributes: {timestamp: 123}})
                            done()
                            eventSource.destroy()
                        })

                    Promise.delay(100).then(function () {
                        seeder(server).dropCollectionsAndSeed({
                            superHeros: [
                                {
                                    type: 'superHeros',
                                    attributes: {
                                        timestamp: 123
                                    }
                                }
                            ]
                        })
                    })
                }
            )
        })

        describe('when I ask for events with ids greater than a certain id with filters enabled', function () {
            it('I should get only one event without setting a limit', function (done) {
                seeder(server).dropCollectionsAndSeed({
                    books: [
                        {
                            type: 'books',
                            attributes: {title: 'test title 3'}
                        },
                        {
                            type: 'books',
                            attributes: {title: 'filtered'}
                        },
                        {
                            type: 'books',
                            attributes: {
                                title: 'filtered',
                                author: 'Asimov'
                            }
                        }
                    ]
                })
                var eventSource = ess(baseUrl + '/books/changes/streaming?attributes.title=filtered&attributes.author=Asimov&limit=100', {
                    retry: false, headers: {
                        'Last-Event-ID': lastEventId
                    }
                }).on('data', function (data) {
                    lastEventId = data.id
                    data = JSON.parse(data.data)
                    //ignore ticker data
                    if (_.isNumber(data)) {
                        return
                    }
                    expect(_.omit(data, 'id', 'type')).to.deep.equal({attributes: {title: 'filtered', author: 'Asimov'}})
                    done()
                    eventSource.destroy()
                })
            })
        })

        describe('when I ask for events with ids greater than a certain id', function () {
            it('I should get only one event without setting a limit', function (done) {
                seeder(server).dropCollectionsAndSeed({
                    books: [
                        {
                            type: 'books',
                            attributes: {
                                title: 'test title 3'
                            }
                        }
                    ]
                })
                var eventSource = ess(baseUrl + '/books/changes/streaming', {
                    retry: false, headers: {
                        'Last-Event-ID': lastEventId
                    }
                }).on('data', function (data) {
                    data = JSON.parse(data.data)
                    //ignore ticker data
                    if (_.isNumber(data)) {
                        return
                    }
                    expect(_.omit(data, 'id', 'type')).to.deep.equal({attributes: {title: 'test title 3'}})
                    done()
                    eventSource.destroy()
                })
            })
        })

        describe('Given a resource x with property y When the value of y changes', function () {
            it('Then an SSE is broadcast with event set to x_update, ID set to the oplog timestamp' +
                'and data set to an instance of x that only contains the new value for property y', function (done) {
                var counter = 0

                var payloads = [
                    {
                        data: {
                            type: 'books',
                            attributes: {
                                title: 'test title 4',
                                author: 'Asimov'
                            }
                        }
                    },
                    {
                        data: {
                            type: 'books',
                            attributes: {
                                title: 'test title 5'
                            }
                        }
                    }
                ]

                var eventSource = ess(baseUrl + '/books/changes/streaming', {retry: false})
                    .on('data', function (data) {
                        lastEventId = data.id
                        data = JSON.parse(data.data)

                        //ignore ticker data
                        if (_.isNumber(data)) {
                            //post data after we've hooked into change events and receive a ticker
                            return $http.post(baseUrl + '/books', {json: payloads[0]})
                                .spread(function (res) {
                                    //TODO in harvesterjs this was PUT instead of PATCH
                                    return $http.patch(baseUrl + '/books/' + res.body.data.id, {json: payloads[1]})
                                })
                        }

                        expect(_.omit(data, 'id')).to.deep.equal(payloads[counter].data)
                        counter++
                        if (counter === 1) {
                            done()
                            eventSource.destroy()
                        }
                    })
            })
        })
    })

    describe('Multi resource', function () {
        this.timeout(20000)
        let lastEventId
        let baseUrl
        const schema = {
                    bookas: {
                        type: 'bookas',
                        attributes: {
                            name: Joi.string()
                        }
                    },
                    bookbs: {
                        type: 'bookbs',
                        attributes: {
                            name: Joi.string()
                        }
                    }
                }

        function sendAndCheckSSE(resources, payloads, done) {
            var index = 0
            var eventSource = ess(baseUrl + '/changes/streaming?resources=' + resources.join(','), {retry: false})
                .on('data', function (res) {
                    lastEventId = res.id
                    let data = JSON.parse(res.data)
                    //ignore ticker data
                    if (_.isNumber(data)) {
                        //post data after we've hooked into change events and receive a ticker
                        return Promise.map(payloads, function (payload) {
                            return seeder(server).seed(payload)
                        }, {concurrency: 1})
                    }

                    expect(res.event.trim()).to.equal('bookas_i')
                    expect(_.omit(data, 'id')).to.deep.equal(payloads[index][resources[index]][0])
                    if (index === payloads.length - 1) {
                        done()
                        eventSource.destroy()
                    }

                    index++
                })
        }

        before(function () {
            baseUrl = 'http://localhost:9100'
            return utils.buildDefaultServer(schema).then(function () {
                //TODO how are we going to register this route in prod?
                server.route({
                    method: 'get',
                    path: '/changes/streaming',
                    handler: sse({
                        context: server
                    })
                })
                return seeder(server).dropCollections('bookas', 'bookbs')
            })
        })

        after(utils.createDefaultServerDestructor())

        describe('Given a resources A AND base URL base_url When a GET is made to base_url/changes/streaming?resources=A', function () {
            it('Then all events for resource A streamed back to the API caller ', function (done) {
                var payloads = [
                    {
                        bookas: [
                            {
                                type: 'bookas',
                                attributes: {
                                    name: 'test name 1'
                                }
                            }
                        ]
                    }
                ]
                sendAndCheckSSE(['bookas'], payloads, done)
            })
        })

        describe('Given a list of resources A, B, C AND base URL base_url When a GET is made to base_url/changes/stream?resources=A,B,C ', function () {
            it('Then all events for resources A, B and C are streamed back to the API caller ', function (done) {
                var payloads = [{
                    bookas: [
                        {
                            type: 'bookas',
                            attributes: {
                                name: 'test name 1'
                            }
                        }
                    ]
                },
                    {
                        bookbs: [
                            {
                                type: 'bookbs',
                                attributes: {
                                    name: 'test name 2'
                                }
                            }
                        ]
                    }]
                sendAndCheckSSE(['bookas', 'bookbs'], payloads, done)
            })
        })

        describe('Given a list of resources A, B, C AND base URL base_url When a GET is made to base_url/changes/stream?resources=A,D ', function () {
            it('Then a 400 HTTP error code and a JSON API error specifying the invalid resource are returned to the API caller ', function () {
                return server.injectThen({method: 'get', url: '/changes/streaming?resources=bookas,wrongResource'}).then(function () {
                    throw new Error('Expected 400 status code')
                }).catch(function (error) {
                    expect(error.isBoom).to.be.true
                    expect(error.output).to.have.property('statusCode', 400)
                    expect(error.output.payload).to.have.property('message', 'The follow resources don\'t exist wrongResource')
                })
            })
        })

        describe('Given a list of resources A, B, C AND base URL base_url When a GET is made to base_url/changes/stream', function () {
            it('Then a 400 HTTP error code and a JSON API error specifying the invalid resource are returned to the API caller ', function () {
                return server.injectThen({method: 'get', url: '/changes/streaming'}).then(function () {
                    throw new Error('Expected 400 status code')
                }).catch(function (error) {
                    expect(error.isBoom).to.be.true
                    expect(error.output).to.have.property('statusCode', 400)
                    const expectedMessage = 'You have not specified any resources, please do so by providing "resource?foo,bar" as query'
                    expect(error.output.payload).to.have.property('message', expectedMessage)
                })
            })
        })

        describe('Given a list of resources A, B, C AND base URL base_url When a GET is made to base_url/changes/stream?resources=A,B ', function () {
            it('Then a 400 HTTP error code and a JSON API error indicating the timestamp is invalid are returned to the API caller. ', function () {
                const headers = {
                    'Last-Event-ID': '1234567_wrong'
                }
                return server.injectThen({method: 'get', url: '/changes/streaming?resources=bookas,bookbs', headers: headers}).then(function () {
                    throw new Error('Expected 400 status code')
                }).catch(function (error) {
                    expect(error.isBoom).to.be.true
                    expect(error.output).to.have.property('statusCode', 400)
                    expect(error.output.payload).to.have.property('message', 'Could not parse the time stamp provided')
                })
            })
        })
    });
})
