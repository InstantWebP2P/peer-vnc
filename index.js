// noVNC proxy implementation with iWebPP.io
// Copyright (c) 2013 Tom Zhou<iwebpp@gmail.com>

var WEBPP = require('iwebpp.io'),
    noVNC = require('./novnc'),
    http = require('http'),
    https = require('https'),
    WebSocket = require('wspp'),
    WebSocketServer = WebSocket.Server,
    Connect = require('connect'),
    OS = require('os'),
    UDT = require('udt');


// Debug level
// 1: display error, proxy entry
// 2: display vnc rfb info
var Debug = 0;

// Proxy class
// a proxy will contain one iwebpp.io name-client
// -    vncs: array of VNC server host:port pair, like ['localhost:5900', '51dese.com:5901'}] 
// -      fn: callback to pass proxy informations
// - options: user custom parameters, like {usrkey: ..., domain: ..., endpoints: ..., turn: ...}
// - options.secmode: ssl, enable ssl/https; acl, enable ssl/https,host-based ACL
// - options.sslmode: srv, only verify server side cert; both, verify both server and client side cert
// -    options:auth: http basic-auth as username:password
var Proxy = module.exports = function(vncs, fn, options){
    var self = this;
       
    if (!(this instanceof Proxy)) return new Proxy(vncs, fn, options);
    
    // check arguments
    if (typeof vncs === 'function') {
        options = fn || {};
        fn = vncs;
        vncs = [];
    } 
    
    if (!Array.isArray(vncs)) vncs = [vncs];
        
    // check basic auth
    var basicauth = false;
    if (options && options.auth) {
    	var astr = options.auth.split(':');
    	basicauth = {username: astr && astr[0], password: astr && astr[1]};
    }
    
    // check upload 
    var fileupload = false;

    // 1.
    // proxy URLs
    self.proxyURL = {}; // vURL for VNC server
    
    // websocket proxy servers
    self.proxyWss = {};
    
    // 2.
    // create name client
    var nmcln = self.nmcln = new WEBPP({
        usrinfo: {
            domain: (options && options.domain) || '51dese.com',
            usrkey: (options && options.usrkey) || ('peervnc@'+Date.now())
        },
        
        srvinfo: {
            timeout: 20,
            endpoints: (options && options.endpoints) || [
                {ip: 'iwebpp.com', port: 51686},
                {ip: 'iwebpp.com', port: 51868}
            ],
            turn: (options && options.turn) || [
                {ip: 'iwebpp.com', agent: 51866, proxy: 51688}
            ]
        },
        
        vmode: WEBPP.vURL.URL_MODE_HOST,
        
        // secure mode
        secmode: (options && options.secmode === 'ssl') ? WEBPP.SEP.SEP_SEC_SSL :
                                                          WEBPP.SEP.SEP_SEC_SSL_ACL_HOST,
        // ssl mode
        sslmode: (options && options.sslmode === 'both') ? WEBPP.SEP.SEP_SSL_AUTH_SRV_CLNT : 
                                                           WEBPP.SEP.SEP_SSL_AUTH_SRV_ONLY
    });
	
	// 2.1
	// check ready
	nmcln.once('ready', function(){
	    if (Debug) console.log('name-client ready on vURL:'+nmcln.vurl);
	    
	    // 3.
	    // setup noVNC proxy
	    for (var idx = 0; idx < vncs.length; idx ++) {
	    	var vncstrs = vncs[idx].split(':');
	    	var vnchost = vncstrs[0];
	    	var vncport = vncstrs[1] ? 
	    			      parseInt(vncstrs[1], 10) : 
	    			      5900; // default VNC port

	    	// assume vncserver listen on 5900 above
	    	vncport = (vncport < 5900) ? 5900 + vncport : vncport;

	    	// add VNC host proxy entry
	    	self.addVNC({host: vnchost, port: vncport});
	    }
	    
	    // 4.
	    // create http App
	    var appHttp = Connect();
	    
	    // 4.1
	    // add third-party connect middle-ware
	    // TBD...
	    
	    // 4.2
	    // add noVNC web service in App
	    appHttp.use(noVNC.webServer({auth: basicauth, upload: fileupload}));
	    
	    // 5.
	    // hook http App on name-client
	    nmcln.bsrv.srv.on('request', appHttp);
	    
	    // 5.1
	    // handle http CONNECT request in case come from forward proxy
        // !!! just create connection to peer-vnc httpps server self.
	    nmcln.bsrv.srv.on('connect', function(req, socket, head) {
            var roptions = {
			        port: nmcln.port,
			        host: nmcln.ipaddr,
                localAddress: {
                    addr: nmcln.ipaddr
                }
	        };
            
            // check req.url
            if (!(req.url && nmcln.vurl.match((req.url.split(':'))[0]))) {
                console.log('invalid proxed url: '+req.url);
                socket.end();
                return;
            }
            
            if (Debug) console.log('http tunnel proxy, connect to self %s:%d for %s', nmcln.ipaddr, nmcln.port, req.url);
            
            var srvSocket = UDT.connect(roptions, function() {
                if (Debug) console.log('http tunnel proxy, got connected!');   
                
                ///srvSocket.write(head);
			    socket.pipe(srvSocket);
			     
			    socket.write('HTTP/1.1 200 Connection Established\r\n' +
			                 'Proxy-agent: Node-Proxy\r\n' +
			                 '\r\n');					    
			    srvSocket.pipe(socket);
            });
            
		    srvSocket.on('error', function(e) {
		        console.log("http tunnel proxy, socket error: " + e);
		        socket.end();
		    });
	    });
	    
	    // 6.
	    // pass proxy URLs back
	    fn(null, self.proxyURL);
	});
	
	// 2.2
	// check error
	nmcln.on('error', function(err){
	    console.log('name-client create failed:'+JSON.stringify(err));
	    fn(err);
	});
};

// add VNC host:port entry
// - vnc: {host: x, port: x}
// - return proxy vURL
Proxy.prototype.addVNC = function(vnc) {
    var self = this;
    
    
    // 0.
    // check vnc host/port
    if (!(vnc && 
    	 (typeof vnc.host === 'string') && 
    	 (typeof vnc.port === 'number'))) {
        console.log('invalid VNC host '+JSON.stringify(vnc));
        return self;
    }
    
    // 1.
    // create ws server to proxy VNC/RFB data
    var vncstr = vnc.host+':'+vnc.port;
	var wspath = '/'+vnc.host+'-'+vnc.port;
	var vncwss = new WebSocketServer({httpp: true, server: self.nmcln.bsrv.srv, path: wspath});
	
	vncwss.on('connection', noVNC.tcpProxy({host: vnc.host, port: vnc.port}));

	self.proxyWss[vncstr] = vncwss;
	self.proxyURL[vncstr] = self.nmcln.vurl + wspath;
		
	// 2.
	// report peer-service
	// like {vurl:x,cate:x,name:x,desc:x,tags:x,acls:x,accounting:x,meta:x}
	self.nmcln.reportService({
		vurl: self.proxyURL[vncstr],
		cate: 'peer-vnc',
		name: 'vnc'+Object.keys(self.proxyWss).length,
		meta: {
				vnchost: vnc.host === 'localhost' ? OS.hostname() : vnc.host,
				vncport: vnc.port
			}
	});
	
	// 3.
	// update peer-service: connection loss, etc
	// TBD...
	    
	return self.proxyURL[vncstr];
};

// remove VNC host:port entry
// - vnc: {host: x, port: x}
Proxy.prototype.removeVNC = function(vnc, fn) {
    var self = this;
    
    
    // 0.
    // check vnc host/port
    if (!(vnc && 
    	 (typeof vnc.host === 'string') && 
    	 (typeof vnc.port === 'number'))) {
        console.log('invalid VNC host '+JSON.stringify(vnc));
        return self;
    }
    
    // 1.
    // close websocket proxy server
    var vncstr = vnc.host+':'+vnc.port;
    
    if (self.proxyWss[vncstr]) {
    	self.proxyWss[vncstr].close();

    	// 2.
    	// remove proxy URL after 2s
    	setTimeout(function(){
    		self.proxyWss[vncstr] = null;
    		self.proxyURL[vncstr] = null;
    	}, 2000);
    }
    
    return self;
};

// simple test 
/*
var server = new Proxy(['192.188.1.101:5900'], function(err, proxyURL){
        console.log('VNC                   Proxy URL(please open it on browser)');
        for (var k in proxyURL) {
            console.log(k+'        '+proxyURL[k]);
        }
    });
*/
