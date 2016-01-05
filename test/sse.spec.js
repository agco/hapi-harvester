'use strict'

const _ = require('lodash')
const Promise = require('bluebird')
const Joi = require('joi')
const utils = require('./utils')
const seeder = require('./seeder')
const $http = require('http-as-promised')
const sse = require('../lib/sse')

var Rx = require('rx');

const EventSource = require('eventsource');

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

        const baseUrl = 'http://localhost:9100'

        this.timeout(5000)

        before(function () {
            return utils.buildDefaultServer(schema)
        })

        after(utils.createDefaultServerDestructor())

        describe('When I post to the newly created resource', function () {
            it('Then I should receive a change event with data but not the one before it', function (done) {

                    const source = new EventSource(baseUrl + '/books/changes/streaming')
                    Rx.Observable.fromEvent(source, 'open')
                        .subscribe(()=> {
                            seeder(server).dropCollectionsAndSeed({
                                books: [
                                    {
                                        type: 'books',
                                        attributes: {
                                            title: 'test title 2'
                                        }
                                    }
                                ]
                            })
                        });

                    Rx.Observable.fromEvent(source, 'books_i')
                        .filter((e)=> {
                            return !_.startsWith(e.type, 'ticker')
                        })
                        .subscribe((e) => {
                            source.close()
                            done()
                        });

                }
            )

        })

        describe('When I post resource with uppercased characters in name', function () {
            it('Then I should receive a change event', function (done) {

                    const source = new EventSource(baseUrl + '/superHeros/changes/streaming')
                    Rx.Observable.fromEvent(source, 'open')
                        .subscribe(()=> {
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
                        });

                    Rx.Observable.fromEvent(source, 'superHeros_i')
                        .filter((e)=> {
                            return !_.startsWith(e.type, 'ticker')
                        })
                        .subscribe((e) => {
                            const data = JSON.parse(e.data)
                            expect(_.omit(data, 'id', 'type')).to.deep.equal({attributes: {timestamp: 123}})
                            source.close()
                            done()
                        });

                }
            )
        })

        describe('when I ask for events with filters enabled', function () {
            it('I should get the relevant event', function (done) {

                const source = new EventSource(baseUrl +
                    '/books/changes/streaming?attributes.title=filtered&attributes.author=Asimov')

                Rx.Observable.fromEvent(source, 'open')
                    .subscribe(()=> {
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
                    });

                Rx.Observable.fromEvent(source, 'books_i')
                    .filter((e)=> {
                        return !_.startsWith(e.type, 'ticker')
                    })
                    .subscribe((e) => {
                        const data = JSON.parse(e.data)
                        expect(_.omit(data, 'id', 'type')).to.deep.equal({
                            attributes: {
                                title: 'filtered',
                                author: 'Asimov'
                            }
                        })
                        source.close()
                        done()
                    })
            })
        })

        describe('when I ask for events with last-event-id set', function () {
            it('I should get the relevant events', function (done) {

                var randomId = _.random(1, Number.MAX_VALUE);

                const source = new EventSource(baseUrl + '/books/changes/streaming')

                Rx.Observable.fromEvent(source, 'open')
                    .subscribe(()=> {
                        seeder(server).dropCollectionsAndSeed({
                            books: [
                                {
                                    type: 'books',
                                    attributes: {
                                        title: `title ${randomId}`
                                    }
                                }
                            ]
                        })
                    });

                const lastEventIdStream = Rx.Observable.fromEvent(source, 'books_i')
                    .filter((e)=> {
                        return !_.startsWith(e.type, 'ticker')
                    })
                    .take(1)
                    .map((e) => {
                        return e.lastEventId
                    })

                lastEventIdStream
                    .subscribe((lastEventId) => {

                        const newSource = new EventSource(baseUrl + '/books/changes/streaming', {
                            headers: {
                                'Last-Event-ID': calcPreviousId()
                            }
                        })

                        function calcPreviousId() {
                            return lastEventId.substring(0, 11) + (Number.parseInt(lastEventId.substring(11)) - 1)
                        }

                        Rx.Observable.fromEvent(newSource, 'books_i')
                            .filter((e)=> {
                                return !_.startsWith(e.type, 'ticker')
                            })
                            .subscribe((e) => {
                                const data = JSON.parse(e.data)
                                expect(_.omit(data, 'id', 'type')).to.deep.equal({attributes: {title: `title ${randomId}`}})
                                newSource.close()
                                source.close()
                                done()
                            })

                    })

            })
        })

        describe('Given a resource x with property y When the value of y changes', function () {
            it('Then an SSE is broadcast with event set to x_update, ID set to the oplog timestamp' +
                'and data set to an instance of x that only contains the new value for property y', function (done) {

                const source = new EventSource(baseUrl + '/books/changes/streaming')

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

                Rx.Observable.fromEvent(source, 'open')
                    .subscribe(()=> {
                        return $http.post(baseUrl + '/books', {json: payloads[0]})
                            .spread(function (res) {
                                return $http.patch(baseUrl + '/books/' + res.body.data.id, {json: payloads[1]})
                            })
                    });

                Rx.Observable.fromEvent(source, 'books_u')
                    .filter((e)=> {
                        return !_.startsWith(e.type, 'ticker')
                    })
                    .subscribe((e) => {
                        const data = JSON.parse(e.data)
                        expect(_.omit(payloads[1].data, 'id', 'type')).to.deep.equal(data)
                        source.close()
                        done()
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

            const source = new EventSource(baseUrl + '/changes/streaming?resources=' + resources.join(','))
            Rx.Observable.fromEvent(source, 'open')
                .subscribe(()=> {
                    return seeder(server).dropCollectionsAndSeed(payloads)
                })


            const shouldBeResult = _.chain(resources)
                .map((resource)=> {
                    return _.get(payloads, resource)
                })
                .flatten()
                .value()

            const subject = new Rx.Subject();

            _.each(resources, (resource)=> {
                Rx.Observable.fromEvent(source, `${resource}_i`)
                    .subscribe(subject)
            })

            subject
                .filter((e)=> {
                    return !_.startsWith(e.type, 'ticker')
                })
                .bufferWithCount(shouldBeResult.length)
                .subscribe((events) => {
                    const data = _.map(events, (event) => {
                        return _.omit(JSON.parse(event.data), 'id')
                    })
                    expect(data).to.deep.equal(shouldBeResult)
                    source.close()
                    done()
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
                this.timeout(10000000)
                var payloads =
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
                sendAndCheckSSE(['bookas'], payloads, done)
            })
        })

        describe('Given a list of resources A, B, C AND base URL base_url When a GET is made to base_url/changes/stream?resources=A,B,C ', function () {
            it('Then all events for resources A, B and C are streamed back to the API caller ', function (done) {
                var payloads = {
                    bookas: [
                        {
                            type: 'bookas',
                            attributes: {
                                name: 'test name 1'
                            }
                        }
                    ],
                    bookbs: [
                        {
                            type: 'bookbs',
                            attributes: {
                                name: 'test name 2'
                            }
                        }
                    ]
                }
                sendAndCheckSSE(['bookas', 'bookbs'], payloads, done)
            })
        })

        describe('Given a list of resources A, B, C AND base URL base_url When a GET is made to base_url/changes/stream?resources=A,D ', function () {
            it('Then a 400 HTTP error code and a JSON API error specifying the invalid resource are returned to the API caller ', function () {
                return server.injectThen({
                    method: 'get',
                    url: '/changes/streaming?resources=bookas,wrongResource'
                }).then(function () {
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
                return server.injectThen({
                    method: 'get',
                    url: '/changes/streaming?resources=bookas,bookbs',
                    headers: headers
                }).then(function () {
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
