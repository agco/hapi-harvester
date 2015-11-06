'use strict'

const chai = require('chai')
const Promise = require('bluebird')
Promise.longStackTraces();

chai.use(require('chai-things'))

chai.config.includeStack = true

global.expect = chai.expect
global.AssertionError = chai.AssertionError
global.Assertion = chai.Assertion
global.assert = chai.assert
