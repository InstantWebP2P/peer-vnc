// noVNC port of Node.js
// Copyright (c) 2013 Tom Zhou<zs68j2ee@gmail.com>

var Connect = require('connect'),
    Net = require('net'),
    Buffer = require('buffer').Buffer,
    Fs = require('fs');


// debug level
var debug = 0;

// web server
var webServer = module.exports.webServer = Connect();

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
    
    return function(ws){
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
                if (debug) console.log('ws.onmessage...'+data.length);
               
                try { 
                    if (!ts.write(data)) {
                        ws.pause();
                    
                        ts.once('drain', function(){
                            ws.resume();
                        });
                    
                        setTimeout(function(){
                            if (ws && ws.resume) ws.resume();
                        }, 100); // 100ms 
                    }
                } catch (e) {
                    if (debug) console.log('ws2ts send error '+e);
                    ws.close();
                }
            });
            ws.on('close', function(){
                if (debug) console.log('ws.onclose...');
                ts.end();
            });
            ws.on('error', function(){
                if (debug) console.log('ws.onerror...');
                ts.end();
            });
            
            // relay data from tcp to ws
            ts.on('data', function(data){
                if (debug) console.log('ts.ondata...'+data.length);
                
                try { 
                    if (ws.supports.binary) {
                        if (!ws.send(data, {binary: true})) {
                            ts.pause();
                        
                            ws.on('drain', function(){
                                ts.resume();
                            });
                         
                            setTimeout(function(){
                                if (ts && ts.resume) ts.resume();
                            }, 100); // 100ms 
                        }
                    } else {                    
                        if (!ws.send(data.toString('base64'), {binary: false})) {
                            ts.pause();
                        
                            ws.on('drain', function(){
                                ts.resume();
                            });
                        
                            setTimeout(function(){
                                ts.resume();
                            }, 100); // 100ms 
                        }
                    }
                } catch (e) {
                    if (debug) console.log('ts2ws send error '+e);
                    ts.end();
                }
            });
            ts.on('end', function(){
                if (debug) console.log('ts.onend...');
                ws.close();
            });
            ts.on('close', function(){
                if (debug) console.log('ts.onclose...');
                ws.close();
            });
            ts.on('error', function(){
                if (debug) console.log('ts.onerror...');
                ws.close();
            });
        });
        
        ts.on('error', function(err){
            if (debug) console.log('tcp connection error '+err);
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

