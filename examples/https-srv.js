var noVNC = require('../novnc'),
    https = require('https'),
    WebSocket = require('wspp'),
    WebSocketServer = WebSocket.Server,
    fs = require('fs');
    
    
var options = {
     key: fs.readFileSync('./certs/server-key.pem'),
    cert: fs.readFileSync('./certs/server-cert.pem')
};
    
var srv = https.createServer(options, noVNC.webServer());
srv.listen(5443);
console.log('noVNC https server listening on 5443');

var wss = new WebSocketServer({server: srv, path: '/peervnc'});
wss.on('connection', noVNC.tcpProxy({host: 'localhost', port: 5901}));
console.log('please access https://localhost:5443/peervnc');

