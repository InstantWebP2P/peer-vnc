var util = require('util');
var Dupplex = require('readable-stream').Duplex;
var WebSocket = require('./WebSocket');


function Uint8ToBuffer(data) {
	// check node buffer first
	if (typeof Buffer != 'undefined' && data instanceof Buffer) {
		return data;
	} else if (data instanceof ArrayBuffer) {
		return data;
	} else if (data instanceof Uint8Array) {
		// check node buffer first
		if (typeof Buffer != 'undefined')
			return new Buffer(data);
		else {
			var ret = new ArrayBuffer(data.length);
			var viw = new Uint8Array(ret);
			viw.set(data);
			return ret;
		} 
	} else {
		console.log('invalid Uint8ToArray:'+JSON.stringify(data));
		return null;
	}
}

// Stream over WebSocket
var Stream = module.exports = function(ws, options) {
	if (!(this instanceof Stream))
		return new Stream(ws, options);
	
	if (!(ws instanceof WebSocket))
		throw new Error('Invalid websocket');
	
	// force writable decode string
	options = options || {};
	options.decodeStrings = true;
	
	Dupplex.call(this, options);

	var self = this;
	
	// Collect data
	self.ws = ws;
	
	self.ws.on('message', function(message, flags) {
		///console.log('ss message:'+JSON.stringify(message));

		if (message && Buffer.isBuffer(message)) {
			if (!self.push(message))
				if (self.ws && self.ws.pause)
					self.ws.pause();
		} else if (message && message instanceof Uint8Array) {
			var chunk = Uint8ToBuffer(message);
			if (!self.push(chunk))
				if (self.ws && self.ws.pause)
					self.ws.pause();
		} else {
			self.emit('warn', 'Invalid ws message:'+JSON.stringify(message));
		}
	});
	// check close
	self.ws.on('close', function(){
		self.push(null);
	});
	// check error
	self.ws.on('error', function(err){
		self.emit('error', 'ws error:'+JSON.stringify(err));
	});
	// check warn
	self.ws.on('warn', function(warn){
		self.emit('warn', 'ws warn:'+JSON.stringify(warn));
	});
}

util.inherits(Stream, Dupplex);

// Duplex implementation
Stream.prototype._read = function(size) {
	var self = this;

	if (self.ws && self.ws.resume)
		self.ws.resume();
}

Stream.prototype._write = function(chunk, encoding, callback) {
	var self = this;
	///console.log('ss write:'+JSON.stringify(chunk));

	if (chunk instanceof Buffer) {
		if (self.ws && self.ws.send)
			self.ws.send(chunk, callback);
	} else {
		self.emit('warn', 'Invalid write buffer:'+JSON.stringify(chunk));
		callback('Invalid write buffer:'+JSON.stringify(chunk));
	}
}

// Expose ws close,terminate
Stream.prototype.close = function() {
	var self = this;

	if (self.ws && self.ws.close)
		self.ws.close();
}

Stream.prototype.terminate = function() {
	var self = this;

	if (self.ws && self.ws.terminate)
		self.ws.terminate();
}
