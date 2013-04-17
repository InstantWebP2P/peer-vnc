// noVNC proxy, tom zhou <zs68j2ee@gmail.com>
var iWebPP.IO = require('iwebpp.io'),
    noVNC = require('./novnc');


// debug level
var debug = 0;

// proxy
var proxy = module.exports = function(options, fn){
    
};


// simple test 
var http = require('http'),
    WebSocket = require('wspp'),
    WebSocketServer = WebSocket.Server;

var test = noVNC({host: '192.188.1.101', port: 5900});

var srv = http.createServer(test.srv);
srv.listen(5600);
console.log('noVNC proxy server listening on 5600');

var wss = new WebSocketServer({server: srv, path: '/websockify'});
wss.on('connection', test.tcproxy);

