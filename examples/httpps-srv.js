var noVNC = require('../novnc'),
    httpps = require('httpps'),
    WebSocket = require('wspp'),
    WebSocketServer = WebSocket.Server,
    fs = require('fs');

var connect = require('connect');
var app = connect();
var forward = require('httpp-forward');

// set httpp capacity middleware
app.use(forward.connect_httpp(5443)); // pass listening port

// noVNC server
app.use(noVNC.webServer);
    
    
var options = {
     key: fs.readFileSync('./certs/server-key.pem'),
    cert: fs.readFileSync('./certs/server-cert.pem')
};
    
var srv = httpps.createServer(options, app);
srv.listen(5443);
console.log('noVNC httpps server listening on udp port 5443');

var wss = new WebSocketServer({httpp: true, server: srv, path: '/peervnc'});
wss.on('connection', noVNC.tcpProxy({host: 'localhost', port: 5901}));
console.log('please access https://localhost:5443/peervnc');

