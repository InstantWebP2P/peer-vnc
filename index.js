// noVNC port of Node.js, tom zhou <zs68j2ee@gmail.com>

var Connect = require('connect'),
    Net = require('net');
    
// VNC server info: {host: ..., port: ...} 
var noVNC = module.exports = function(vnc){
    vnc = vnc || {};
    
    vnc.host = vnc.host || 'localhost';
    vnc.port = vnc.port || 5900;

    // http server
    var srv = Connect();
    
    srv.use(Connect.static(__dirname));
    
    srv.use(function(req, res){
        res.writeHeader(200);
        res.end('Unknown path');
    });
    
    // tcp proxy over ws
    var tcproxy = function(ws){
        // create tcp connection to VNC server
        var ts = Net.connect(vnc, function(){
            console.log('tcp connection...');
            
            // relay data from ws to tcp
            ws.on('message', function(data){
                console.log('ts.write...');
                ts.write(data);
            });
            ws.on('close', function(){
                console.log('ts.end...');
                ts.end();
            });
            
            // relay data from tcp to ws
            ts.on('data', function(data){
                console.log('ws.send...');
                ws.send(data, {binary: true});
            });
            ts.on('end', function(){
                console.log('ws.close...');
                ws.close();
            });
        });
        
        ts.on('error', function(err){
            console.log('tcp connection error '+err);
            ws.close();
        });
    };
    
    return {srv: srv, tcproxy: tcproxy};
};

// simple test 
var http = require('http'),
    WebSocket = require('wspp'),
    WebSocketServer = WebSocket.Server;

var test = noVNC();

var srv = http.createServer(test.srv);
var wss = new WebSocketServer({server: srv, path: 'tcp'});

wss.on('connection', test.tcproxy);

srv.listen(5600);

console.log('noVNC proxy server listening on 5600');

