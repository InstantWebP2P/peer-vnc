var util = require('util');
var Dupplex = require('readable-stream').Duplex;
var sws = require('./sws');
var SecureWebSocket = sws.SecureWebSocket;
var Uint8ToBuffer = sws.Uint8ToBuffer;


// Secure stream over SecureWebSocket
var SecureStream = module.exports = function(sws, options) {
	if (!(this instanceof SecureStream))
		return new SecureStream(sws, options);
	
	if (!(sws instanceof SecureWebSocket))
		throw new Error('Invalid secure websocket');
	
	// force writable decode string
	options = options || {};
	options.decodeStrings = true;
	
	Dupplex.call(this, options);

	var self = this;
	
	// Collect data
	self.sws = sws;
	
	self.sws.on('message', function(message, flags) {
		///console.log('ss message:'+JSON.stringify(message));

		if (message && Buffer.isBuffer(message)) {
			if (!self.push(message))
				if (self.sws && self.sws.pause)
					self.sws.pause();
		} else if (message && message instanceof Uint8Array) {
			var chunk = Uint8ToBuffer(message);
			if (!self.push(chunk))
				if (self.sws && self.sws.pause)
					self.sws.pause();
		} else {
			self.emit('warn', 'Invalid sws message:'+JSON.stringify(message));
		}
	});
	// check close
	self.sws.on('close', function(){
		self.push(null);
	});
	// check error
	self.sws.on('error', function(err){
		self.emit('error', 'sws error:'+JSON.stringify(err));
	});
	// check warn
	self.sws.on('warn', function(warn){
		self.emit('warn', 'sws warn:'+JSON.stringify(warn));
	});
}

util.inherits(SecureStream, Dupplex);

// Duplex implementation
SecureStream.prototype._read = function(size) {
	var self = this;

	if (self.sws && self.sws.resume)
		self.sws.resume();
}

SecureStream.prototype._write = function(chunk, encoding, callback) {
	var self = this;
	///console.log('ss write:'+JSON.stringify(chunk));

	if (chunk instanceof Buffer) {
		if (self.sws && self.sws.send)
			self.sws.send(chunk, callback);
	} else {
		self.emit('warn', 'Invalid write buffer:'+JSON.stringify(chunk));
		callback('Invalid write buffer:'+JSON.stringify(chunk));
	}
}

// Expose sws close,terminate
SecureStream.prototype.close = function() {
	var self = this;

	if (self.sws && self.sws.close)
		self.sws.close();
}

SecureStream.prototype.terminate = function() {
	var self = this;

	if (self.sws && self.sws.terminate)
		self.sws.terminate();
}

