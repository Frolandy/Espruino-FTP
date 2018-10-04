var config = function(configuration){

	this.ip = configuration.ip;
	this.port = configuration.port;
	this.user = configuration.user;
	this.password = configuration.password;
	this.fileName = configuration.fileName;
	this.format = configuration.format;

}


exports.setup = function(configuration){

	return new config(configuration);

}
