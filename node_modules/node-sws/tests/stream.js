var SWS = require('../index.js');

var skp = SWS.keyPair();
var ssc = {myPublicKey: skp.publicKey, mySecretKey: skp.secretKey};

var srv = SWS.createServer({path: '/ss', port: 6628, secinfo: ssc}, function(ws){
	///console.log('server client connected');
	
	// create stream over secure websocket
	var ss = new SWS.Stream(ws, {encoding: null, decodeStrings: true});
		
	// echo
	ss.pipe(ss);
});


var ckp = SWS.keyPair();
var csc = {myPublicKey: ckp.publicKey, mySecretKey: ckp.secretKey};

var cln = SWS.connect('ws://localhost:6628/ss', csc);
cln.on('open', function(){
	///console.log('client connected');

	// create stream over secure websocket
	var ss = new SWS.Stream(cln, {encoding: null, decodeStrings: true});

	// stdin.pipe(ws).pipe(stdout) 
	process.stdin.setEncoding('utf8');
	process.stdin.pipe(ss).pipe(process.stdout);
	process.stdin.resume();
	
	console.log('Type one char, echo back:\n');
});

