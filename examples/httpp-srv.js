var noVNC = require('../novnc'),
    httpp = require('httpp'),
    WebSocket = require('wspp'),
    WebSocketServer = WebSocket.Server;
    
var connect = require('connect');    
var app = connect();
var forward = require('httpp-forward');

// set httpp capacity middleware 
app.use(forward.connect_httpp(5080)); // pass listening port

// noVNC server
app.use(noVNC.webServer());

var srv = httpp.createServer(app);
srv.listen(5080);
console.log('noVNC httpp server listening on udp port 5080');

var wss = new WebSocketServer({httpp: true, server: srv, path: '/peervnc'});
wss.on('connection', noVNC.tcpProxy({host: 'localhost', port: 5901}));
console.log('please access http://localhost:5080/peervnc');
