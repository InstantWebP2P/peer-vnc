var SecureWebSocket = require('../index.js');
var SecureWebSocketServer = SecureWebSocket.Server;
var Uint8ToBuffer = SecureWebSocket.Uint8ToBuffer;
var nacl = require('tweetnacl/nacl-fast');
var msgpack = require('msgpack-js');


var skp = nacl.box.keyPair();
var wss = new SecureWebSocketServer(
		{port: 6668, host: 'localhost', path: '/wspp', httpp: true},
		{
				myPublicKey: skp.publicKey,
				mySecretKey: skp.secretKey
		});
wss.on('connection', function(ws){
	ws.on('message', function(message, flags){
		///console.log('srv msg:'+JSON.stringify(message));
		
		if (flags.binary) {
			console.log('server message:'+msgpack.decode(message));
			ws.send(message);
		} else 
			console.error('Not support String message');
	});
});

var ckp = nacl.box.keyPair();
var ws = new SecureWebSocket(
		'ws://127.0.0.1:6668/wspp', 
		{
				httpp: true,

				naclinfo: {
					myPublicKey: ckp.publicKey,
					mySecretKey: ckp.secretKey
				}
		});

ws.on('open', function(){
	console.log('secure ws connected');
	
	ws.on('message', function(message, flags){
		///console.log('cln msg:'+JSON.stringify(message));

		if (flags.binary) {
			console.log('client message:'+msgpack.decode(message));
		} else {
			console.log('Not support String:'+JSON.stringify(message))
		}
	});
	setInterval(function(){
		ws.send(msgpack.encode('Hello,Am tom@'+Date.now()));
	}, 2000);
});

ws.on('warn', function(warn){
	console.log('Warning: '+JSON.stringify(warn));
});

ws.on('error', function(err){
	console.log('Error: '+JSON.stringify(err));
});

// V2 with NaclCert
var naclcert = require('nacl-cert');
var rootCA = naclcert.generateCA({name: 'iwebpp.com', tte: new Date('2020-01-01').getTime()});

var srvkp = nacl.box.keyPair();
var srvReqDesc = {
	version: '1.0',
	type: 'ca',
	tte: new Date('2016-01-01').getTime(),
	publickey: naclcert.Uint8ToArray(srvkp.publicKey),
	names: ['localhost', '51dese.com', 'ruyier.com', 'localhost'],
	ips: ['127.0.0.1']
};
var srvcert = naclcert.generate(srvReqDesc, rootCA.secretkey, rootCA.cert);

var clnkp = nacl.box.keyPair();
var clnReqDesc = {
	version: '1.0',
	type: 'ca',
	tte: new Date('2016-01-01').getTime(),
	publickey: naclcert.Uint8ToArray(clnkp.publicKey),
	names: ['localhost'],
	ips: ['127.0.0.1']
};
var clncert = naclcert.generate(clnReqDesc, rootCA.secretkey, rootCA.cert);


var cwss = new SecureWebSocketServer(
		{port: 6688, host: 'localhost', path: '/wspp', httpp: true},
		{
				    version: 2,
				       cert: srvcert,
				         ca: rootCA.cert,
				requireCert: true,
				
				myPublicKey: srvkp.publicKey,
				mySecretKey: srvkp.secretKey,
		});
cwss.on('connection', function(ws){
	ws.on('message', function(message, flags){
		///console.log('srv msg:'+JSON.stringify(message));
		
		if (flags.binary) {
			console.log('V2 server message:'+msgpack.decode(message));
			ws.send(message);
		} else 
			console.error('V2 Not support String message');
	});
});

var cws = new SecureWebSocket(
		'ws://localhost:6688/wspp', 
		{
				httpp: true,
				
				naclinfo: {
					version: 2,
					   cert: clncert,
					     ca: rootCA.cert,

					myPublicKey: clnkp.publicKey,
					mySecretKey: clnkp.secretKey
				}
		});

cws.on('open', function(){
	console.log('V2 secure ws connected');
	
	ws.on('message', function(message, flags){
		///console.log('cln msg:'+JSON.stringify(message));

		if (flags.binary) {
			console.log('V2 client message:'+msgpack.decode(message));
		} else {
			console.log('V2 Not support String:'+JSON.stringify(message))
		}
	});
	setInterval(function(){
		ws.send(msgpack.encode('V2 Hello,Am tom@'+Date.now()));
	}, 2000);
});

cws.on('warn', function(warn){
	console.log('Warning: '+JSON.stringify(warn));
});

cws.on('error', function(err){
	console.log('Error: '+JSON.stringify(err));
});

