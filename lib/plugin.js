exports.register = function (server, options, next) {
	console.log('PLUGIN STARTED')
	server.expose('version', require('../package.json').version);
	next()
}

exports.register.attributes = {
	pkg: require('../package.json')
}
