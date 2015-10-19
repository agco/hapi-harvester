const chai = require('chai')
const _ = require('lodash')

chai.use(require('chai-things'))

chai.config.includeStack = true

global.expect = chai.expect
global.AssertionError = chai.AssertionError
global.Assertion = chai.Assertion
global.assert = chai.assert
global.utils = {
	getData : function(res) {
		var data = res.result.data;
		return _.omit(data, 'id')
	}
}