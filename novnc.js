// noVNC port of Node.js
// Copyright (c) 2013 Tom Zhou<iwebpp@gmail.com>

var Connect = require('connect'),
    Net = require('net'),
    Buffer = require('buffer').Buffer,
    Fs = require('fs'),
    WSS = require('wspp').Stream;


// Debug level
var Debug = 0;

// web server
var webServer = module.exports.webServer = Connect();

// rewrite req.url to remove vToken string
var vtokenregex = /\/vtoken\/([0-9]|[a-f]){16}/gi;

webServer.use(function(req, res, next){
    if (vtokenregex.test(req.url)) {
        res.writeHead(301, {'location': req.url.replace(vtokenregex, '')});
        res.end();
    } else {
        next();
    }
});

///webServer.use(Connect.staticCache({maxLength: 256*1024, maxObjects: 8}))
webServer.use(Connect.static(__dirname));
    
webServer.use(function(req, res){
    res.writeHeader(200, {'content-type': 'text/html'});
    res.end(Fs.readFileSync(__dirname+'/novnc.html'));
});

// ws2tcp proxy
// vnc: {host: ..., port: ...}, VNC server info
var tcpProxy = module.exports.tcpProxy = function(vnc){
    vnc = vnc || {};
    
    vnc.host = vnc.host || 'localhost';
    vnc.port = vnc.port || 5900;
    
	if (Debug) console.log('connect to vnc %j ...', vnc);

    return function(ws){
    	// create tcp connection to VNC server        
    	var ts = Net.connect(vnc, function(){
    		if (Debug) console.log('tcp connection...');

    		// wrap stream on ws
    		var wss = new WSS(ws);

    		// pipe each other
    		wss.pipe(ts);
    		ts.pipe(wss);

    		// check error
    		wss.on('error', function(){
    			if (Debug) console.log('ws.onerror...');
    			ts.end();
    		});
    	});

    	// check error
    	ws.on('error', function(){
    		if (Debug) console.log('ws.onerror...');
    		ts.end();
    	});
    	ts.on('error', function(err){
    		if (Debug) console.log('tcp connection error '+err);
    		ws.close();
    	});
    };
};

// simple test 
/*var http = require('http'),
    WebSocket = require('wspp'),
    WebSocketServer = WebSocket.Server;
    
var srv = http.createServer(webServer);
srv.listen(5600);
console.log('noVNC proxy server listening on 5600');

var wss = new WebSocketServer({server: srv, path: '/peervnc'});
wss.on('connection', tcpProxy({host: '192.188.1.101', port: 5900}));
*/

