var chai = require('chai')

chai.use(require('chai-things'))

chai.config.includeStack = true

global.expect = chai.expect
global.AssertionError = chai.AssertionError
global.Assertion = chai.Assertion
global.assert = chai.assert