// SecureWebSocket Server implementation with NACL
// Copyright (c) 2014 Tom Zhou<iwebpp@gmail.com>


var util = require('util');
var events = require('events');
var WebSocketServer = require('ws').Server;
var SecureWebSocket = require('./sws').SecureWebSocket;


var SecureWebSocketServer = module.exports = function(options, callback, secinfo) {
	if (!(this instanceof SecureWebSocketServer))  
		return new SecureWebSocketServer(options, callback, secinfo);

	// check parameters
	if (options && 
		callback && (typeof callback === 'function') &&
		secinfo && (typeof secinfo === 'object')) {
	} else if (options && 
			   callback && (typeof callback === 'object')) {
		secinfo = callback;
		callback = null;
	} else {
		throw new Error('Invalid SecureWebSocketServer arguments:'+arguments);
	}

	events.EventEmitter.call(this);
	
	var self = this;
	// setup security info
	self.mySecInfo = secinfo;
			
	self.wss = new WebSocketServer(options, callback);
	
	// wrap SecureWebSocket
	self.wss.on('connection', function(ws){
		var sws = new SecureWebSocket(ws, self.mySecInfo);
		
		sws.on('open', function(){
			self.emit('connection', sws);
		});
	});
}

util.inherits(SecureWebSocketServer, events.EventEmitter);

SecureWebSocketServer.prototype.close = function() {
	this.wss.close();
}

SecureWebSocketServer.prototype.on = function(event, fn) {
	if (event === 'connection')
		this.addListener(event, fn);
	else 
		this.wss.addListener(event, fn);
}

SecureWebSocketServer.prototype.once = function(event, fn) {
	var self = this;

	var selftemp = function() {
		fn.apply(self, arguments);
		self.removeListener(event, selftemp);
	};
	var wsstemp = function() {
		fn.apply(self.wss, arguments);
		self.wss.removeListener(event, wsstemp);
	};

	if (event === 'connection')
		self.addListener(event, selftemp);
	else 
		self.wss.addListener(event, wsstemp);
}

