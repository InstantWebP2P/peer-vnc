// noVNC proxy, tom zhou <zs68j2ee@gmail.com>
var iWebPP.IO = require('iwebpp.io'),
    noVNC = require('./novnc'),
    http = require('http'),
    https = require('https'),
    WebSocket = require('wspp'),
    WebSocketServer = WebSocket.Server;;


// debug level
// 1: display error, proxy entry
// 2: display vnc rfb info
var debug = 0;

// Proxy class
// a proxy will contain one iwebpp.io name-client
// -    vncs: array of VNC server host:port pair, like ['localhost:5900', '51dese.com:5901'}] 
// -      fn: callback to pass proxy informations
// - options: user custom parameters, like {usrkey: ..., domain: ..., endpoints: ..., turn: ...}
var Proxy = module.exports = function(vncs, fn, options){ 
    var self = this;
       
    if (!(this instanceof Proxy)) return new Proxy(vncs, fn, options);
    
    if (!Array.isArray(vncs)) vncs = [vncs];
        
    // 1.
    // proxy URLs
    self.proxyURL = {}; // vURL for VNC server
    
    // 2.
    // create name client
    var nmcln = self.nmcln = new WEBPP({
        usrinfo: {
            domain: (options && options.domain) || '51dese.com',
            usrkey: (options && options.usrkey) || 'dese'
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
        }
    });
	
	// 2.1
	// check ready
	nmcln.on('ready', function(){
	    if (debug) console.log('name-client ready on vURL:'+nmcln.vurl);
	    
	    // 3.
	    // setup noVNC proxy
	    for (var idx = 0; idx < vncs.length; idx ++) {
	        var vncstrs = vncs[idx].split(':');
	        var vnchost = vncstrs[0];
	        var vncport = vncstrs[1] || 5900; // default VNC port
	    
	        // create ws server to proxy VNC/RFB data
	        var wspath = '/novnc' + (idx ? idx : '');
	        var vncwss = new WebSocketServer({server: nmcln.bsrv.srv, path: wspath});
	        
	        vncwss.on('connection', noVNC.tcpProxy({host: vnchost, port: vncport}));
	        
	        self.proxyURL[vncs[idx]] = nmcln.vurl + wspath;
	    }
	    
	    // 4.
	    // hook noVNC web server on name-client
	    nmcln.bsrv.srv.on('request', noVNC.webServer);
	    
	    // 5.
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

// simple test 
var server = new Proxy(['192.188.1.101:5900'], function(err, proxyURL){
        console.log('VNC                            Proxy URL(please open it on browser)');
        for (var k in proxyURL) {
            console.log(k+'        '+proxyURL[k]);
        }
    });

