module.exports.register = function (server, options, next) {
	console.log('PLUGIN STARTED')
	next()
}

exports.register.attributes = {
	pkg: require('./package.json')
}
