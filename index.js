// noVNC port of Node.js, tom zhou <zs68j2ee@gmail.com>

var Connect = require('connect'),
    Net = require('net'),
    Buffer = require('buffer').Buffer,
    Fs = require('fs');


// debug level
var debug = 0;

// VNC server info: {host: ..., port: ...} 
var noVNC = module.exports = function(vnc){
    vnc = vnc || {};
    
    vnc.host = vnc.host || 'localhost';
    vnc.port = vnc.port || 5900;

    // http server
    var srv = Connect();
    
    srv.use(Connect.static(__dirname));
    
    srv.use(function(req, res){
        res.writeHeader(200, {'content-type', 'text/html'});
        res.end(Fs.readFileSync(__dirname+'/novnc.html'));
    });
    
    // tcp proxy over ws
    var tcproxy = function(ws){    
        // create tcp connection to VNC server
        var ts = Net.connect(vnc, function(){
            if (debug) console.log('tcp connection...');
            
            // relay data from ws to tcp
            ws.on('message', function(data, flags){
                if (flags.binary) {
                    if (debug) console.log('binary ws message');
                } else {
                    data = new Buffer(data);
                }
                if (debug) console.log('ws.onmessage...'+data.length+','+data.toString());
                
                if (!ts.write(data)) {
                    ws.pause();
                    
                    ts.once('drain', function(){
                        ws.resume();
                    });
                    
                    setTimeout(function(){
                        ws.resume();
                    }, 100); // 100ms 
                }
            });
            ws.on('close', function(){
                console.log('ws.onclose...');
                ts.end();
            });
            ws.on('error', function(){
                console.log('ws.onerror...');
                // send RFB error code
                // TBD...
                ts.end('error');
            });
            
            // relay data from tcp to ws
            ts.on('data', function(data){
                console.log('ts.ondata...'+data.length+','+data.toString());
                if (ws.supports.binary) {
                    if (!ws.send(data, {binary: true, mask: true})) {
                        ts.pause();
                        
                        ws.on('drain', function(){
                            ts.resume();
                        });
                        
                        setTimeout(function(){
                            ts.resume();
                        }, 100); // 100ms 
                    }
                } else {                    
                    if (!ws.send(ws.send(data.toString('base64'), {binary: false, mask: true})) {
                        ts.pause();
                        
                        ws.on('drain', function(){
                            ts.resume();
                        });
                        
                        setTimeout(function(){
                            ts.resume();
                        }, 100); // 100ms 
                    }
                }
            });
            ts.on('end', function(){
                console.log('ts.onend...');
                ws.close();
            });
            ts.on('close', function(){
                console.log('ts.onclose...');
                ws.close();
            });
            ts.on('error', function(){
                console.log('ts.onerror...');
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

var test = noVNC({host: '192.188.1.101', port: 5900});

var srv = http.createServer(test.srv);
srv.listen(5600);
console.log('noVNC proxy server listening on 5600');

var wss = new WebSocketServer({server: srv, path: '/websockify'});
wss.on('connection', test.tcproxy);

