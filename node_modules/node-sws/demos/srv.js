var connect = require('connect');
var http = require('http');
var sws = require('../index');
var msgpack = require('msgpack-js');
var Naclcert = sws.Naclcert;

var srv = connect();

srv.use(connect.static(__dirname+'/content/'));
srv.use(function(req, res){
	res.writeHead(400, 'Invalid path');
	res.end();
});

var app = http.createServer(srv);

var kp = sws.keyPair();
var swss = sws.createServer({
	server: app, 
	path: '/wspp', 
	
	secinfo: {
	        version: 1,
	    myPublicKey: kp.publicKey,
	    mySecretKey: kp.secretKey
	}
});
swss.on('connection', function(ws){
	ws.on('message', function(message, flags){
		if (flags.binary) {
			var data = msgpack.decode(message);
			console.log('Server message:'+data);
			ws.send(message);
		} else {
			console.log('Not support String message');
		}
	});
	
	ws.on('close', function(){
		console.log('sws closed');
	});
});

// V2 with NaclCert
var bkp = sws.keyPair();
// prepare reqdesc
var reqdesc = {
      version: '1.0',
         type: 'ca',
          tte: new Date('2018-01-01').getTime(),
    publickey: sws.Uint8ToArray(bkp.publicKey),
        names: ['51dese.com','ruyier.com','localhost'],
          ips: ['127.0.0.1']
};

var bcert = Naclcert.generate(reqdesc, Naclcert.testCA.secretkey, Naclcert.testCA.cert);

var swss2 = sws.createServer({
	server: app, 
	path: '/wspp/v2', 
	
	secinfo: {
		    version: 2,
	           cert: bcert,
	             ca: Naclcert.testCA.cert,
	    requireCert: true,
	             
	    myPublicKey: bkp.publicKey,
	    mySecretKey: bkp.secretKey,
	}
});
swss2.on('connection', function(ws){
	ws.on('message', function(message, flags){
		if (flags.binary) {
			var data = msgpack.decode(message);
			console.log('Server message V2:'+data);
			ws.send(message);
		} else {
			console.log('Not support String message');
		}
	});

	ws.on('close', function(){
		console.log('sws closed');
	});
});

app.listen(6188);
console.log('SecureWebSocketServer listen on 6188');
