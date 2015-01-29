// iWebPP.IO name-client V2 implementation
// Copyright (c) 2014 Tom Zhou<iwebpp@gmail.com>

// eventEmitter
var eventEmitter = require('events').EventEmitter,
    util = require('util'),
    httpp = require('httpp'),
    httpps = require('httpps'),
    https = require('https'),
    UDT = require('udt'), // for hole punch, isIP
    NET = require('net'), // for tunneling
    os = require('os'), // for network interface check
    DNS = require('dns'),
    URL = require('url'),
    FS = require('fs');
    
// MSGPACK library
var MSGPACK = require('msgpack-js');

// UUID generator
var UUID = require('node-uuid');

// p2p stream websocket library
///var WebSocket = require('wspp');
///var WebSocketServer = WebSocket.Server;

// secure websocket library
var SecureWebSocket = require('node-sws');
var SecureWebSocketServer = SecureWebSocket.Server;
var Naclcert = SecureWebSocket.Naclcert;

// Session establish protocol
var SEP = require('./sep');

// vURL 
var vURL = require('./vurl');

// root CA for connection to ns/as
var vCA = FS.readFileSync(__dirname+'/../ca/ca-cert.pem');

// Debug level
// 1: display error
// 2: display info
var Debug = 0;


// helpers
function isLocalhost(host){
    return ((host === 'localhost') || (host === '127.0.0.1') ||
            (host === '0:0:0:0:0:0:0:1') || (host === '::1'));
}

// vToken represents as /vtoken/xxx
function genvTokenStr(vtoken){
    return (vtoken ? '/vtoken/'+vtoken : '');
}

// name-client pair: one primary client, another client bind on the same port and connect to alternate name-server.
// option argument consists of srvinfo,usrinfo,devinfo,conmode,secmode,vURL mode:
// - srvinfo: {
//   endpoints: xxx,
//     timeout: xxx, // in sec
//        turn: [{ip: xxx, agent: xxx, proxy: xxx}] // TURN server endpoints with ip and proxy/agent ports
// - }
// - usrinfo: user MUST put user-specific info here to identify user globally,
//            for exmaple, user name+password->usrkey, domain name, etc
// - devinfo: device identity, etc, that used to generate devkey
// - conmode: c/s or p2p connection mode
// - secmode: secure mode, SSL, etc
// - sslmode: ssl authentication mode, server only, both client and server
// -   vmode: vURL mode, 'vpath' or 'vhost', default is 'vhost'
// -  ipmode: IPv6 or IPv4. 4: IPv4, 6: IPv6
// -    intf: {ipaddr: xxx, port: xxx} // bing on dedicated local interface
// -keephole: true - keep punched hole live, false or null - close hole after punched, default true
// - backlog: server listen backlog, default 1024
var nmCln = exports = module.exports = function(options, fn){
    var self = this;
    
    if (!(this instanceof nmCln)) return new nmCln(options, fn);
        
    // super constructor
    eventEmitter.call(self);
        
    if (typeof options === 'function') {
        fn = options;
        options = {};
    }

    // check on version
    self.version = 2;
    
    /////////////////////////////////////////////////////////////////
    // arguments check
    if (options === undefined || options.usrinfo === undefined) {
        console.error('please enter usrinfo parameter like: {usrinfo: {domain: "51dese.com", usrkey: "dese"}}');
        this.state = 'fail';
        this.emit('error', 'invalid arguments');
        return;
    }
    // default server information
    options.srvinfo = options.srvinfo || {
        timeout: 20,
        endpoints: [{ip: 'iwebpp.com', port: 52686}, {ip: 'iwebpp.com', port: 52868}],
        turn: [
            {ip: 'iwebpp.com', agent: 52866, proxy: 52688} // every turn-server include proxy and agent port
        ]
    };
    // default connection mode
    if (options.conmode === undefined) 
        options.conmode = SEP.SEP_MODE_CS;
    ////////////////////////////////////////////////////////////////////

    var conn;
    var rsdp;
    var srvinfo = options.srvinfo;
    var usrinfo = options.usrinfo;
    var devinfo = options.devinfo;
    var conmode = options.conmode;
    
    // TBD as option and exchange between peers
    var keephole = false; ///options.keephole === false ? false : true;

    // TBD optimizing listening backlog
    var backlog = options.backlog || 1024;
    
    // level-based ACL
    var secmode = (options.secmode === undefined) ? 
    		SEP.SEP_SEC_NONE : options.secmode; 
    // SSL authentication mode
    var sslmode = (options.sslmode === undefined) ? 
    		SEP.SEP_SSL_AUTH_SRV_ONLY : options.sslmode; 
    // vpath or vhost 
    var   vmode = (options.vmode === undefined) ? vURL.URL_MODE_HOST : options.vmode; 
    
    // Generate SecureWebSocket keypair
    self.swskeypair   = SecureWebSocket.keyPair(); 
    self.swscert      = null;
    self.swspublickey = SecureWebSocket.Uint8ToArray(self.swskeypair.publicKey);
    
    //
    // state machine: 
    // new->connecting->(connected/timeout/error)->
    // (ready->reconnecting->connecting->(connected/timeout/error)->ready)->
    // closing->closed
    // 
    self.state = 'new';
    
    // reconnect count
    self.reconnect = 0;
    
    // offer/answer session cache
    self.offans_sdp  = []; // sdp session info
    ///self.offans_stun = []; // stun session info
    ///self.offans_turn = []; // turn session info
    ///self.offans_user = []; // login user info
    
    // userinfo/identity
    self.usrinfo = usrinfo;
    
    // deviceinfo/identity
    // TBD... got device identity by name UUID version 1 or 3 natively
    self.devinfo = devinfo || {devkey: UUID.v1()};
    
    // connection mode / security mode / ssl auth mode: https, etc
    self.conmode     = conmode;
    self.secmode     = secmode;
    self.secerts     =    null; // secure certification in case https/wss key/cert/ca, etc
    self.sslmode     = sslmode; // SSL authentication mode
    self.srvsslcerts =    null; // server certs

    // keep hole or not
    self.keephole = keephole;

    // listening backlog
    self.backlog = backlog;
    
    // serverinfo
    // at least connect to two name servers
    self.srvinfo = srvinfo;
    self.srvs    = srvinfo.endpoints ||
                   [{ip: 'localhost', port: 51686},
                    {ip: 'localhost', port: 51868}];
    self.ocnt    =           0; // opened connection count to servers
    self.conn    =          {}; // connections to name-server
    
    // IP mode: IPv4 or IPv6
    self.ipmode  = (options.ipmode === undefined) ? 4 : options.ipmode;
    
    // local/inner IP address info
    self.port    = (options.intf && options.intf.port) || 0; // all coonection MUST bind on the same port!!!
    self.ipaddr  = (options.intf && options.intf.ipaddr) || null; // all coonection MUST bind on the same local interface
    
    // public/outter IP address info 
    self.gid     =   UUID.v1(); // GID of name-client
    self.natype  =           0; // 0: cone NAT/FW, 1: symmetric NAT/FW
    self.oipaddr =          ''; // the out address seen by peer. if NAT exists, it should be NAT/gw address, not local address
    self.oport   =           0; // the out port seen by primary name-server
    self.geoip   =        null; // GeoIP of name-client
    
    self.peer    =          {}; // connections pool to peers
    self.hole    =          {}; // hole-keep connection to peers
    
    // at most one business server on self.ipaddr/port for UDT or HTTPP or Websocket
    self.bsrv    =          {}; // business server bind on self.port in c/s connection mode
    
    // vURL info
    self.vmode     =     vmode;
    self.vpath     =        '';
    self.vhost     =        '';
    self.tvurl     =        ''; // TURN based vURL
    self.svurl     =        ''; // STUN based vURL TBD...
    self.vurl      =        ''; // vURL generic hard-code as tvurl by now
    self.vtoken    =        ''; // vURL security token
    self.vtokenstr =        ''; // vURL security token string like /vtoken/xxx

    // turn server obj cache
    // TBD balance... now only connect to one turn server
    if (srvinfo.turn) {
        self.turnSrvs      = Array.isArray(srvinfo.turn) ? srvinfo.turn : [srvinfo.turn];
        self.turnagentConn = {}; // connection to turn agent server
    } else {
        self.turnSrvs       = null;
        self.turnagentReady = false;
    }
    
    // ACL cache
    // notes: only allow incoming connection from turn-server agent port and 
    // authorized peer name-client
    // like: {'v4:ip:port': true} - allow; {'v4:ip:port': null or false} - reject;
    //       {     'v4:ip': true} - allow; {     'v4:ip': null or false} - reject;
    self.acls = {};
        
 
    // Launch normal logics ->//////////////////////////////////////////////////////////
    
    // 1.
    // get valid network IP address and setup SDP session once 
    self._getValidIPAddr(self.ipmode, function(err, addr){
        if (!err && addr) {
            // record local IP address
            self.ipaddr = addr;

		    // 1.1
		    // setup SDP session once
		    self._LSM_setupSdpSession();
        } else {
            console.log('no outgoing network interface');
            self.state = 'error';
            self.emit('error', 'no outgoing network interface');
        }
    });
    
    // 2.
    // Launch business server once ready
    self.once('ready', function(){
        if (Debug) console.log('SDP session ready, launch business server');
        
        // launch business server
        self._LSM_setupBusinessServer();
    });
    
    // 3.
    // Handle reconnect
    self.on('reconnect', function(event){
        if (Debug) console.log('Reconnect by '+event+', '+self.reconnect+' times');

        // 3.1
        // increase reconnect count
        self.reconnect += 1;
        
        // 3.2
        // clear all existing connections
	    try {
	        // close name-server connection
	        for (var k in self.conn)
	            if (self.conn[k] && self.conn[k].socket && self.conn[k].socket.close) {
	                self.conn[k].socket.close();
		        }
	        
	        // close turn agent connection
	        if (self.turnagentConn && self.turnagentConn.close) {
	            self.turnagentConn.close();
	        }
	        
	        // clear peer connections
	        // TBD...

	        // clear hole-keep connections
	        for (var h in self.hole)
	        	if (self.hole[h] && self.hole[h].socket && self.hole[h].socket.close) {
	        		self.hole[h].socket.close();
	        	} 
        } catch (e) {
            console.log('clear all sockets, ignore '+e);
        }
        
        // 3.3
        // clear all existing servers
        // TBD... 
        
        // 3.6
        // relaunch SDP session after 2s
        setTimeout(function(){
            self._LSM_setupSdpSession();
        }, 2000);
    });
    
    // 6.
    // hook user callback once ready
    if (typeof fn === 'function') {
        self.once('ready', fn);
    }
    
    //<- Launch normal logics //////////////////////////////////////////////////////////
};

util.inherits(nmCln, eventEmitter);

// Internal methods for LSM

// get valid network interface IP address
nmCln.prototype._getValidIPAddr = function(proto, fn){
    var self = this;

    // 0.
    // extract local IP address interface and test connection avalabiltity to name-server
    var intfs = os.networkInterfaces();
    var addr4 = [], addr6 = [];
    
    function testConnection2NS(laddr, fn){
        var wsproto = self.secmode ? 'wss://' : 'ws://';
        var wsopt = {
        		httpp: true, hole: {addr: laddr},

        		// NACL cert info
        		naclinfo: {
        			    version: 2,
        			       cert: {},
        			         ca: Naclcert.rootCACert,
        			requireCert: true,

        			myPublicKey: self.swskeypair.publicKey,
        			mySecretKey: self.swskeypair.secretKey,
        		}
        };
        // SSL related info
        if (self.secmode) {
        	wsopt.rejectUnauthorized = true;
        	wsopt.ca = vCA;
        }
        
        var   nscon = new SecureWebSocket(wsproto+self.srvs[0].ip+':'+self.srvs[0].port+SEP.SEP_CTRLPATH_NS, wsopt);
        var   nstmo = setTimeout(function(){
            fn(0);
            if (Debug) console.log('connect to NS from '+laddr+' ... timeout');
        }, 2000); // 2s timeout
        
        nscon.on('open', function(){
            clearTimeout(nstmo);
            fn(1, laddr);
            nscon.close();
            ///console.log('connect to NS from '+laddr+' ... ok');
        });
        nscon.on('error', function(err) {
            console.log('connect to NS from '+laddr+' ... err:'+err);
        });
    }
           
    // 0.2
    // extract all network interfaces
    ///console.log('network interfaces: '+JSON.stringify(intfs));
    
    for (var k in intfs) {
        for (var kk in intfs[k]) {
            if (((intfs[k])[kk].internal === (self.srvs[0].ip === 'localhost' || self.srvs[0].ip === '127.0.0.1')) &&
                ('IPv4' === (intfs[k])[kk].family)) {
               // find foreign network interface
               addr4.push((intfs[k])[kk].address);
            }
            
            if (((intfs[k])[kk].internal  === (self.srvs[0].ip === 'localhost' || self.srvs[0].ip === '0:0:0:0:0:0:0:1')) &&
                ('IPv6' === (intfs[k])[kk].family)) {
               // find foreign network interface
               addr6.push((intfs[k])[kk].address);
            }
        }
    }
    
    // 0.3
    // test network interface availability
    var intfsaddr = (proto == 6) ? addr6 : addr4;
    var intfskkok = 0;
    
    for (var idx = 0; idx < intfsaddr.length; idx ++) {
        // skip loop
        if (intfskkok) break;
         
        // test connection 
        testConnection2NS(intfsaddr[idx], function(yes, addr){
            if (yes && !intfskkok) {
                // select first available foreign network interface
                intfskkok = 1;
                
			    // send back ipaddr
			    fn(null, addr);
            } else if ((idx === (intfsaddr.length-1)) && !intfskkok) {
                console.log('failed get IPv'+proto+' address');
                fn('failed get IPv'+proto+' address');
            }
        });
    }
};

// connect to TURN agent server to setup TURN/PUNCH session
nmCln.prototype._LSM_connectTurnAgent = function(fn, tmo){
    var self = this;

    // 0.
    // callback event count
    self.clntturnagentCbCnt = self.clntturnagentCbCnt || 0;

    // 1.
    // make websocket connection to agent port
    // TBD... secure agent server
    if (self.turnSrvs && self.turnSrvs.length) {
        var wsproto = self.secmode ? 'wss://' : 'ws://';
        
        if (Debug) console.log('turn agent connection:'+wsproto+self.turnSrvs[0].ip+':'+self.turnSrvs[0].agent+SEP.SEP_CTRLPATH_AS);
        
        var wsopt = {
        		httpp: true, hole: {port: self.port, addr: self.ipaddr},
        		
        		// NACL cert info
        		naclinfo: {
        			    version: 2,
        			       cert: {},
        			         ca: Naclcert.rootCACert,
        			requireCert: true,

        			myPublicKey: self.swskeypair.publicKey,
        			mySecretKey: self.swskeypair.secretKey,
        		}
        };
        // SSL related info
        if (self.secmode) {
        	wsopt.rejectUnauthorized = true;
        	wsopt.ca = vCA;
        }
        self.turnagentConn = new SecureWebSocket(wsproto+self.turnSrvs[0].ip+':'+self.turnSrvs[0].agent+SEP.SEP_CTRLPATH_AS, wsopt);

        // initialize offer message count per client
        // every time, client send one offer message, increase it by one
        self.turnagentConn.offerMsgcnt = 0;
        
        var t = setTimeout(function(){
	        self.removeAllListeners('clntturnagent'+self.clntturnagentCbCnt);
            fn('connect TURN agent server timeout');
        }, (tmo || 30)*1000); // 30s timeout in default
    
        self.turnagentConn.on('open', function(){            
            if (Debug) console.log('connected to turn agent server successfully');
            
            // 1.1
            // waiting for hole punch answer message
            self.once('clntturnagent'+self.clntturnagentCbCnt, function(yes){
                clearTimeout(t);
                fn(null, yes);
            });
            
            // 2.
            // send hole punch offer message anyway
            var tom = {};
            tom.opc = SEP.SEP_OPC_PUNCH_OFFER;
            
            tom.offer = {
                // protocol info
                version: 2,
                  proto: 'udp',
                   mode: SEP.SEP_MODE_CS,
                 
                 // user info
                 domain      : (self.usrinfo && self.usrinfo.domain) || '51dese.com',
                 usrkey      : (self.usrinfo && self.usrinfo.usrkey) || 'tomzhou',
        
                // client info
                vmode        : self.vmode,   // vURL mode
                secmode      : self.secmode, // security mode
                clntgid      : self.gid,
                clntlocalIP  : self.ipaddr,
                clntlocalPort: self.port,
                devkey       : (self.devinfo && self.devinfo.devkey) || 'iloveyou',
                
                // server info
                    srvip: self.turnSrvs[0].ip,
                proxyport: self.turnSrvs[0].proxy,
                agentport: self.turnSrvs[0].agent                 
            };
            
            tom.seqno = self.turnagentConn.offerMsgcnt++;
            
            // !!! put callback event count            
            tom.evcbcnt = self.clntturnagentCbCnt++;
            
            try {
            	// V2 use msgpack
            	self.turnagentConn.send(MSGPACK.encode(tom), {binary: true, mask: false}, function(err){
            		if (err) console.log(err+',send turn agent punch offer info failed');
            	});
            } catch (e) {
                console.log(e+',send turn agent punch offer failed immediately');
            }
        });
        
        // 3.
        // handle agent server message
        self.turnagentConn.on('message', function(message, flags){
            var tdata = (flags.binary) ? MSGPACK.decode(message) : JSON.parse(message);
            ///console.log('nmclnt:new turn agent message:'+JSON.stringify(tdata));

            // check if opc is valid
            if ('number' === typeof tdata.opc) {
                switch (tdata.opc) {
                // offer/answer opc /////////////////////////////////////////////
                case SEP.SEP_OPC_PUNCH_ANSWER:
                    ///console.log('turn/punch session:'+JSON.stringify(tdata.answer));
                    
                    // 3.1
                    // check offer credit
                    
                    // 3.2
                    // check answer
                    if (tdata.answer && tdata.answer.ready) {
                        self.turnagentReady = true;
                        
                        // record vURL security token
                        if (self.secmode > SEP.SEP_SEC_SSL) {
                            self.vtoken    = tdata.answer.vtoken;
                            self.vtokenstr = genvTokenStr(self.vtoken);
                        } else {
                            self.vtoken    = '';
                            self.vtokenstr = '';
                        }
                    } else {
                        self.turnagentReady = false;
                    }
                    self.emit('clntturnagent'+tdata.evcbcnt, self.turnagentReady);
        
                    break;
                    
                default:
                    console.log('unknown opc:'+JSON.stringify(tdata));
                    break;
                }
            } else {
                 console.log('unknown message:'+JSON.stringify(tdata));    
            }
        });
        
        // 4.
        // handle close event with reconnect
        self.turnagentConn.on('close', function(){
            if (Debug) console.log('turn agent client closed');
            
            // 4.1
            // trigger reconnect event
            if (self.state === 'ready') {
                self.state = 'reconnecting';
                self.emit('reconnect', 'turn agent client closed');
            }
        });
    } else {
        console.log('no TURN server');
        fn('no TURN server');
    }
};

// setup SDP session
nmCln.prototype._LSM_setupSdpSession = function() {
    var self = this;
    
    // initialize state
    self.ocnt = 0;
 
    // on meessage process
    function onMessage(message, flags) {
        // flags.binary will be set if a binary message is received
        // flags.masked will be set if the message was masked
        var data = (flags.binary) ? MSGPACK.decode(message) : JSON.parse(message);
        ///console.log('nmcln:new message:'+JSON.stringify(data));

        // 1.
        // check if opc is valid
        if ('number' === typeof data.opc) {
            switch (data.opc) {
            case SEP.SEP_OPC_SDP_ANSWER:
                    
                if (data.answer.state === SEP.SEP_OPC_STATE_READY) {
                    self.offans_sdp.push(data);
                    
                    // in case connected to all name-servers
                    ///console.log('self.offans_sdp.length %d, self.srvs.length %d', self.offans_sdp.length, self.srvs.length);
                    if (self.offans_sdp.length === self.srvs.length) {
                        // 2.
                        // check if symmetric nat/firewall by answer, then extract clint's public ip/port
                        // TBD... sdp decision in server side
                        var symmetric = 0;
                        for (var idx = 0; idx < (self.offans_sdp.length - 1); idx ++) {
                            /*if (Debug) {
                                console.log('SDP answer %d: %s', idx, JSON.stringify(self.offans_sdp[idx].answer.sdp));
                                console.log('SDP answer %d: %s', idx+1, JSON.stringify(self.offans_sdp[idx+1].answer.sdp));
                            }*/
                            
                            if (!((self.offans_sdp[idx].answer.sdp.clntIP && self.offans_sdp[idx+1].answer.sdp.clntIP) &&
                                  (self.offans_sdp[idx].answer.sdp.clntPort && self.offans_sdp[idx+1].answer.sdp.clntPort) &&
                                  (self.offans_sdp[idx].answer.sdp.clntIP === self.offans_sdp[idx+1].answer.sdp.clntIP) &&
                                  (self.offans_sdp[idx].answer.sdp.clntPort === self.offans_sdp[idx+1].answer.sdp.clntPort))) {
                                symmetric = 1;
                                break;
                            }
                        }
                        
                        // 2.1
                        // record client GID, NAT type, public Ip/Port
                        ///self.gid     = self.offans_sdp[0].answer.client.gid;
                        self.vpath   = self.offans_sdp[0].answer.client.vpath;
                        self.vhost   = self.offans_sdp[0].answer.client.vhost;
                        self.natype  = symmetric;
                        self.oipaddr = self.offans_sdp[0].answer.sdp.clntIP;
                        self.oport   = self.offans_sdp[0].answer.sdp.clntPort;
                        self.geoip   = self.offans_sdp[0].answer.client.geoip;
                        if (Debug) console.log('GeoIP:'+JSON.stringify(self.geoip));
                        
                        // 2.1.1
                        // record server's Domain Name
                        self.srvinfo.dn = self.offans_sdp[0].answer.server.dn;
                        
                        // 2.1.2
                        // enable vURL if TURN ready
                        if (self.turnagentReady) {
                            var vurlproto = self.secmode ? 'https://' : 'http://';
                            
                            if (self.vmode === vURL.URL_MODE_PATH) {
                                // vpath-based turn vURL
                                self.tvurl = vurlproto+
                                             self.srvinfo.turn[0].ip+
                                             ((self.srvinfo.turn[0].proxy === 443) ? '' : (':'+self.srvinfo.turn[0].proxy));
                                             
                                // append vToken in secure vURL mode
                                self.tvurl += (self.secmode > SEP.SEP_SEC_SSL) ? self.vtokenstr : '';
                                
                                // append vPath            
                                self.tvurl += self.vpath;
                            } else {
                                // vhost-based turn vURL
                                // notes: 
                                // - vhost-based vURL MUST use domain name instead of ip address
                                // - vhost-based vURL MUST Not use localhost
                                self.tvurl = vurlproto+
                                             self.vhost+
                                             (self.srvinfo.dn || self.srvinfo.turn[0].ip)+
                                             ((self.srvinfo.turn[0].proxy === 443) ? '' : (':'+self.srvinfo.turn[0].proxy));
                                             
                                // append vToken in secure vURL mode
                                self.tvurl += (self.secmode > SEP.SEP_SEC_SSL) ? self.vtokenstr : '';
                            }
                            
                            // TBD... STUN session based vURL
                            
                            // generic vURL hard-code as tvurl
                            // TBD...
                            self.vurl = self.tvurl;
                        }
                        
                        // 2.1.3
                        // record security certification /////////////////////////////////////////////
                        
                    	// client certs
                    	self.secerts = self.offans_sdp[0].answer.secerts || {};
                    	self.secerts.ca = vCA;

                        // ssl certs
                    	if (self.secmode) {
                    		// server certs
                    		self.srvsslcerts = {};

                    		// https certification like: {key: xxx, cert: xxx, ca: xxx}
                    		['key', 'cert',  'ca'].forEach(function(k){
                    			self.srvsslcerts[k] = self.secerts[k];
                    		});

                    		// check ssl auth mode like: {requestCert: xxx, rejectUnauthorized: xxx}
                    		if (self.sslmode === SEP.SEP_SSL_AUTH_SRV_CLNT) {
                    			['requestCert', 'rejectUnauthorized'].forEach(function(k){
                    				self.srvsslcerts[k] = self.secerts[k];
                    			});
                    		} else {
                    			self.srvsslcerts.requestCert = false;
                    			self.srvsslcerts.rejectUnauthorized = false;
                    		}

                    		///console.log('client SSL cert:'+JSON.stringify(self.secerts));
                    		///console.log('server SSL cert:'+JSON.stringify(self.srvsslcerts));
                    	}
                        
                        // NACL certs
                        self.swscert = self.secerts.naclcert;
                        ///////////////////////////////////////////////////////////////////////////////
                        		
                        // 2.2
                        // return sdp info to user
                        rsdp = {
                        	// protocol info
                            version: self.version,
                        		
                            // GID of name-client
                              gid: self.gid,
                            vpath: self.vpath,
                            vhost: self.vhost,
                            
                            // connection/secure/vURL mode
                            conmode: self.conmode,
                            secmode: self.secmode,
                              vmode: self.vmode,
                             vtoken: self.vtoken,
                            
                            // NAT/FW type
                            natype: symmetric, // 0: cone NAT/FW, 1: symmetric NAT/FW
                                
                            // local binding address/port
                            port: self.port,
                            addr: self.ipaddr,
                                
                            // from sdp offer/answer exchange
                              publicIP: self.oipaddr,
                            publicPort: self.oport, // useless it's symmetric NAT/FW
                            
                            // GeoIP
                            geoip: self.geoip
                        };
                        self.emit('clntsdpanswer'+data.evcbcnt, rsdp);
                            
                        ///console.log('got SDP successfully:'+JSON.stringify(rsdp));
                    }
                } else {
                    // return error info
                    self.emit('clntsdpanswer'+data.evcbcnt, {err: 'create sdp offer failed '+(data.answer.error ? data.answer.error : '')});
                    console.log('create sdp offer failed:'+JSON.stringify(data));
                }
                break;
                
            case SEP.SEP_OPC_NAT_ANSWER:
                // 1.
                // check answer state
                if ((data.answer.state === SEP.SEP_OPC_STATE_READY) && data.answer.ready) {
                    // 2.
                    // send back stun info
                    self.emit('clntnatypeanswer'+data.evcbcnt);
                            
                    ///console.log('update client nat type info successfully:'+JSON.stringify(data));
                } else {
                    // return error info
                    self.emit('clntnatypeanswer'+data.evcbcnt, 'update client nat type info failed '+(data.answer.error ? data.answer.error : ''));
                    console.log('update client nat type info failed:'+JSON.stringify(data));
                }
                break;

            case SEP.SEP_OPC_HEART_BEAT_ANSWER:
                // 1.
                // check answer state
                if ((data.answer.state === SEP.SEP_OPC_STATE_READY) && data.answer.ready) {
                    // 2.
                    // send back stun info
                    self.emit('clntheartbeatanswer'+data.evcbcnt);
                            
                    ///console.log('update client heart-beat successfully:'+JSON.stringify(data));
                } else {
                    // return error info
                    self.emit('clntheartbeatanswer'+data.evcbcnt, 'update client heart-beat failed '+(data.answer.error ? data.answer.error : ''));
                    console.log('update client heart-beat failed:'+JSON.stringify(data));
                }
                break;
                    
            case SEP.SEP_OPC_PUNCH_OFFER:
                // 1.
                // check offer credits
                
                // 2.
                // punch hole
                self.punchHole({
                        endpoint: data.offer.peer,
                     isInitiator: data.offer.isInitiator
                 },
                 function(err, coninfo){
                    // fill answer
                    data.opc    = SEP.SEP_OPC_PUNCH_ANSWER;
                    data.answer = {};
                        
                    if (!err && coninfo) {
                        data.answer.state = SEP.SEP_OPC_STATE_READY;
                        data.answer.ready = true;
                        data.answer.cinfo = coninfo; // pass connection external ip/port info
                    } else {
                        data.answer.state = SEP.SEP_OPC_STATE_FAIL;
                        data.answer.ready = false;
                    }
                    // 3.
                    // send back punch answer to name-servers
                    // TBD... balance among name-servers
                    // Algorithem:
                    // - for both of asymmmetric NAT/FW, send message from Initiator side to name-server
                    // - for one asymmetric NAT/FW, another's symmetric, send message from symmetric side
                    // - for both of symmmetric NAT/FW, send message from Initiator side to name-server
                    if (!(self.natype || data.offer.peer.natype)) {
                        // send message from Initiator only
                        if (data.offer.isInitiator) self.sendOpcMsg(data);
                    } else if (self.natype || data.offer.peer.natype) {
                        // send message from symmetric side only
                        if (self.natype) self.sendOpcMsg(data);
                    } else {
                        // send message from Initiator only
                        if (data.offer.isInitiator) self.sendOpcMsg(data);
                    }
                });
                break;

            case SEP.SEP_OPC_STUN_ANSWER:
                // 1.
                // check answer state
                if ((data.answer.state === SEP.SEP_OPC_STATE_READY) && data.answer.ready) {
                    // 2.
                    // send back stun info
                    self.emit('clntstunanswer'+data.evcbcnt, data.answer.stun);
                            
                    ///console.log('got stun info successfully:'+JSON.stringify(data));
                } else {
                    // return error info
                    self.emit('clntstunanswer'+data.evcbcnt, {err: 'ask client stun session failed '+(data.answer.error ? data.answer.error : '')});
                    console.log('ask client stun session failed:'+JSON.stringify(data));
                }
                break;
                
            case SEP.SEP_OPC_TURN_ANSWER:
                // 1.
                // check answer state
                if ((data.answer.state === SEP.SEP_OPC_STATE_READY) && data.answer.ready) {
                    // 2.
                    // send back turn info for initiator
                    if (data.answer.isInitiator) {
                        self.emit('clntturnanswer'+data.evcbcnt, data.answer.turn);
                    } else {
                        // 2.1
                        // just log in responsor client
                        console.log('Waiting for TURN/PROXY relay connection:'+JSON.stringify(data.answer.turn));
                    }
                            
                    ///console.log('got turn info successfully:'+JSON.stringify(data));
                } else {
                    // return error info
                    self.emit('clntturnanswer'+data.evcbcnt, {err: 'ask client turn session failed '+(data.answer.error ? data.answer.error : '')});
                    console.log('ask client turn session failed:'+JSON.stringify(data));
                }
                break;
            
            // user management opc -> //////////////////////////////////////////////
            case SEP.SEP_OPC_CLNT_SDP_ANSWER:
                // 1.
                // check answer state
                if (data.answer.state === SEP.SEP_OPC_STATE_READY) {
                    // 2.
                    // send back sdp info
                    self.emit('clntsdps'+data.evcbcnt, data.answer.sdps);
                            
                    ///console.log('got sdp info successfully:'+JSON.stringify(data));
                } else {
                    // return error info
                    self.emit('clntsdps'+data.evcbcnt, {err: 'ask client sdp session failed '+(data.answer.error ? data.answer.error : '')});
                    console.log('ask client sdp session failed:'+JSON.stringify(data));
                }
                break;
                
            case SEP.SEP_OPC_ALL_USR_ANSWER:
                // 1.
                // check answer state
                if (data.answer.state === SEP.SEP_OPC_STATE_READY) {
                    // 2.
                    // send back login info
                    self.emit('allusrs'+data.evcbcnt, data.answer.usrs);
                            
                    ///console.log('got user info successfully:'+JSON.stringify(data));
                } else {
                    // return error info
                    self.emit('allusrs'+data.evcbcnt, {err: 'ask user info failed '+(data.answer.error ? data.answer.error : '')});
                    console.log('ask user info failed:'+JSON.stringify(data));
                }
                break;
                
            case SEP.SEP_OPC_ALL_LOGIN_ANSWER:
                // 1.
                // check answer state
                if (data.answer.state === SEP.SEP_OPC_STATE_READY) {
                    // 2.
                    // send back login info
                    self.emit('alllogins'+data.evcbcnt, data.answer.logins);
                            
                    ///console.log('got user logins successfully:'+JSON.stringify(data));
                } else {
                    // return error info
                    self.emit('alllogins'+data.evcbcnt, {err: 'ask user all logins failed '+(data.answer.error ? data.answer.error : '')});
                    console.log('ask user logins failed:'+JSON.stringify(data));
                }
                break;

            case SEP.SEP_OPC_USR_LOGIN_ANSWER:
                // 1.
                // check answer state
                if (data.answer.state === SEP.SEP_OPC_STATE_READY) {
                    // 2.
                    // send back login info
                    self.emit('usrlogins'+data.evcbcnt, data.answer.logins);
                            
                    ///console.log('got user logins successfully:'+JSON.stringify(data));
                } else {
                    // return error info
                    self.emit('usrlogins'+data.evcbcnt, {err: 'ask user logins failed '+(data.answer.error ? data.answer.error : '')});
                    console.log('ask user logins failed:'+JSON.stringify(data));
                }
                break;
            // user management opc <- //////////////////////////////////////////////
            
            // service management opc -> //////////////////////////////////////
            case SEP.SEP_OPC_SRV_REPORT_ANSWER:
                // 1.
                // check answer state
                if (data.answer.state === SEP.SEP_OPC_STATE_READY) {
                    // 2.
                    // send back service info
                    self.emit('reportsrv'+data.evcbcnt, data.answer.srv);
                    
                    ///console.log('report service successfully:'+JSON.stringify(data));
                } else {
                    // return error info
                    self.emit('reportsrv'+data.evcbcnt, {err: 'report serivce failed '+(data.answer.error ? data.answer.error : '')});
                    console.log('report service failed:'+JSON.stringify(data));
                }
                break;
                
            case SEP.SEP_OPC_SRV_UPDATE_ANSWER:
                // 1.
                // check answer state
                if (data.answer.state === SEP.SEP_OPC_STATE_READY) {
                    // 2.
                    // send back service info
                    self.emit('updatesrv'+data.evcbcnt, data.answer.srv);
                    
                    ///console.log('update service successfully:'+JSON.stringify(data));
                } else {
                    // return error info
                    self.emit('updatesrv'+data.evcbcnt, {err: 'update serivce failed '+(data.answer.error ? data.answer.error : '')});
                    console.log('update service failed:'+JSON.stringify(data));
                }
                break;
                
            case SEP.SEP_OPC_SRV_QUERY_ANSWER:
                // 1.
                // check answer state
                if (data.answer.state === SEP.SEP_OPC_STATE_READY) {
                    // 2.
                    // send back service info
                    self.emit('querysrv'+data.evcbcnt, data.answer.srv);
                    
                    ///console.log('query service successfully:'+JSON.stringify(data));
                } else {
                    // return error info
                    self.emit('querysrv'+data.evcbcnt, {err: 'query serivce failed '+(data.answer.error ? data.answer.error : '')});
                    console.log('query service failed:'+JSON.stringify(data));
                }
                break;                
            // service management opc <- ////////////////////////////////////
            
            // vURL management opc -> ///////////////////////////////////////
            case SEP.SEP_OPC_VURL_INFO_ANSWER:
                // 1.
                // check answer state
                if (data.answer.state === SEP.SEP_OPC_STATE_READY) {
                    // 2.
                    // send back vURL info
                    self.emit('vurlinfo'+data.evcbcnt, data.answer.info);
                            
                    if (Debug) console.log('got vURL info successfully:'+JSON.stringify(data));
                } else {
                    // return error info
                    self.emit('vurlinfo'+data.evcbcnt, {err: 'get vURL info failed '+(data.answer.error ? data.answer.error : '')});
                    console.log('get vURL info failed:'+JSON.stringify(data));
                }
                break;
            // vURL management opc <- ///////////////////////////////////////
            
            default:
                console.log('unknown opc:'+JSON.stringify(data));
                break;
            }
        } else {
            console.log('unknown message:'+JSON.stringify(data));    
        }
    }
    
    // 1.
    // start the first connection on random port,then waiting alternate connection
    // with 10s timeout.
    var wsproto = self.secmode ? 'wss://' : 'ws://';
    
    // notes: for reconnection, use existing port
    var conn = null, wsopt;
    
    if (self.reconnect) {
    	wsopt = {
    			httpp: true, hole: {addr: self.ipaddr, port: self.port},

    			// NACL cert info
    			naclinfo: {
    				    version: 2,
    				       cert: {},
    				         ca: Naclcert.rootCACert,
    				requireCert: true,

    				myPublicKey: self.swskeypair.publicKey,
    				mySecretKey: self.swskeypair.secretKey,
    			}
    	};
    	// SSL related info
    	if (self.secmode) {
    		wsopt.rejectUnauthorized = true;
    		wsopt.ca = vCA;
    	}

    	conn = new SecureWebSocket(wsproto+self.srvs[0].ip+':'+self.srvs[0].port+SEP.SEP_CTRLPATH_NS, wsopt);
    } else {
    	wsopt = {
    			httpp: true, hole: {addr: self.ipaddr},

    			// NACL cert info
    			naclinfo: {
    				    version: 2,
    				       cert: {},
    			 	         ca: Naclcert.rootCACert,
    				requireCert: true,

    				myPublicKey: self.swskeypair.publicKey,
    				mySecretKey: self.swskeypair.secretKey,
    			}
    	};
    	// SSL related info
    	if (self.secmode) {
    		wsopt.rejectUnauthorized = true;
    		wsopt.ca = vCA;
    	}

    	conn = new SecureWebSocket(wsproto+self.srvs[0].ip+':'+self.srvs[0].port+SEP.SEP_CTRLPATH_NS, wsopt);
    }
                           
    // initialize offer message count per client
    // every time, client send one offer message, increase it by one
    conn.offerMsgcnt = 0;
    conn.nmsrv = self.srvs[0];
    
    self.conn[JSON.stringify(self.srvs[0])] = {socket: conn, to: self.srvs[0]};
    
    var t = setTimeout(function(){
        self.state = 'timeout';
        self.emit('timeout', 'connection timeout');
        
        // close all connection
        try {
	        for (var k in self.conn) {
	            if (self.conn[k] && self.conn[k].socket && self.conn[k].socket.close) {
	                self.conn[k].socket.close();
	            }
	        }
        } catch (e) {
            console.log('clear all sockets, ignore '+e);
        }
    }, (self.srvinfo.timeout || 20)*1000); // 20s timeout in default
    
    conn.on('open', function(){
        ///console.log('connection to the first name-server');
        
        // increase opened client count
        self.ocnt ++;
        
        // 2.
        // update state to connecting
        self.state = 'connecting';
        
        // 3.
        // record binding on port/ip/fd, then start alternate connections
        self.fd   = conn.address().fd;
        self.port = conn.address().port;
        if (Debug) console.log('nmclnt binding on %s:%d with fd:%d', self.ipaddr, self.port, self.fd);
        
        for (var i = 1; i < self.srvs.length; i ++) {
        	var wsopt = {
        			httpp: true, hole: {port: self.port, addr: self.ipaddr},

        			// NACL cert info
        			naclinfo: {
        				    version: 2,
        				       cert: {},
        				         ca: Naclcert.rootCACert,
        				requireCert: true,

        				myPublicKey: self.swskeypair.publicKey,
        				mySecretKey: self.swskeypair.secretKey,
        			}
        	};
        	// SSL related info
        	if (self.secmode) {
        		wsopt.rejectUnauthorized = true;
        		wsopt.ca = vCA;
        	}
        	
            var connalt = new SecureWebSocket(wsproto+self.srvs[i].ip+':'+self.srvs[i].port+SEP.SEP_CTRLPATH_NS, wsopt);
            // initialize offer message count per client
            // every time, client send one offer message, increase it by one
            connalt.offerMsgcnt = 0;
            connalt.nmsrv = self.srvs[i];
             
            self.conn[JSON.stringify(self.srvs[i])] = {socket: connalt, to: self.srvs[i]};

            // 4.
            // all connection ready, then emit nmCln ready event
            connalt.on('open', function(){
                // increase opened connection count
                self.ocnt++;
                
                if (self.ocnt === self.srvs.length) {
                    clearTimeout(t);
                                       
                    // 5.
	                // emit connected event immediately
                    self.state = 'connected';
                                     
                    // 5.1
                    // connect TURN agent server
                    if (self.turnSrvs) {
                        self._LSM_connectTurnAgent(function(err, yes){
                            if (!err && yes) {
                                self.turnagentReady = true;
                            } else {
                                self.turnagentReady = false;
                            }
                            
                            self.emit('connected');                                    
                        });
                    } else {
                        self.emit('connected');
                    }
                }
            });
            
            // 5.
            // on message
            connalt.on('message', onMessage);
            
            // 6.
            // handle close event with reconnect
            connalt.on('close', function(){
                if (Debug) console.log('name-server alternate client close');
                
                // 6
                // trigger reconnect event
                if (self.state === 'ready') {
                    self.state = 'reconnecting';
                    self.emit('reconnect', 'name-server alternate client close');
                }
            });
            connalt.on('error', function(err){
                console.log('name-server alternate client error '+err);
            });
        }
    });
	    
    // on message
    conn.on('message', onMessage);

    // on close with reconnect
    conn.on('close', function(){				        
        if (Debug) console.log('name-server primary client close');
        
        // trigger reconnect event
        if (self.state === 'ready') {
            self.state = 'reconnecting';
            self.emit('reconnect', 'name-server primary client close');
        }
    });
         
    // on error
    conn.on('error', function(err){				        
        self.state = 'error';
        self.emit('error', err+',name-server primary client error');
        
        console.log('name-server primary client error '+err);
    });
		    
    //////////////////////////////////////////////////////////////////////////////
    // handle connected event, then emmit ready event. We are ready Now!!!
    self.once('connected', function(){
        if (Debug) console.log('connected offerSdp ...');
        
        // offer initial SDP session
        self.offerSdp(function(err, sdp){
            if (!err) {
                if (Debug) console.log('got SDP answer:'+JSON.stringify(sdp));
            
                // 6.
                // offer initial NAT type report session
                self.updateNatype(function(err){
                    if (!err) {
                        if (Debug) console.log('update natype info successfully');
                        
                        // 7.
		                // notificate ready event
		                // notes: if it's reconnection, emit reready
		                if (self.reconnect == 0) {
		                    // first connect
		                    console.log('iWebPP.io connect ready');
		                    
		                    self.state = 'ready';                        
		                    self.emit('ready', self);
		                    
		                    // start heart-beat timer
		                    self._LSM_startHeartbeat();
		                } else {
		                    // reconnect
		                    console.log('iWebPP.io reconnect ready '+self.reconnect+' times');
		                    
		                    self.state = 'ready';                        
		                    self.emit('reready', self);
		                    
		                    // start heart-beat timer
		                    self._LSM_startHeartbeat();
		                }
                    } else {
                        // 7.
                        // notificate error event
                        console.log(err+',setup NAT report session failed');
                        self.state = 'error';
                        self.emit('error', err+',setup NAT report session failed');
                    }
                });
            } else {
                console.log(err+',setup SDP session failed');
                self.state = 'error';
                self.emit('error', err+',setup SDP session failed');
            }
	    });
    });
};

// Launch local business server listen on local ipaddr/port
nmCln.prototype._LSM_setupBusinessServer = function(){
    var self = this;
    
    // 1.
    // launch business server in case c/s connection mode
    // notes: just export http business server for user
	if (self.conmode === SEP.SEP_MODE_CS) {
	    // 1.1
	    // create httpp server first
	    // notes: leave app logics to user
	    // TBD... optimizing backlog according to udt/udp buffer size
	    if (self.secmode) // https options: key/cert/ca/...
	        self.bsrv.srv = httpps.createServer(self.srvsslcerts).listen(self.port, self.ipaddr, self.backlog);
	    else
	        self.bsrv.srv = httpp.createServer().listen(self.port, self.ipaddr, self.backlog);
	    
	    // 1.1.1
	    // !!! apply ACL check on every incoming connection of business server
	    self.bsrv.srv.on('connection', function(socket){
	        if (self.checkAcl(socket.remoteAddress, socket.remotePort)) {
	            if (Debug) console.log('Pass ACL check on '+socket.remoteAddress+':'+socket.remotePort);
	        } else {
	        	// TBD... block incoming connection by FW
	            console.log('!!! DDOS attack from '+socket.remoteAddress+':'+socket.remotePort+ ', close it');
	            
	            if (socket.destroy)
	                socket.destroy();
	            else if (socket.close)
	                socket.close();
	        }
	    });
	    
	    // 1.2
	    // hook websocket hole punch server on httpp server
	    
	    // 1.2.1
	    // check vURL mode and secure mode
	    self.bsrv.hpsrv = new SecureWebSocketServer({
	    	 httpp: true, 
	    	server: self.bsrv.srv, 
	    	  path: SEP.SEP_CTRLPATH_HS
	    }, 
	    // NACL certs
	    {
	    		    version: 2,
	    		       cert: self.swscert,
				         ca: Naclcert.rootCACert,
	    		requireCert: true,

	    		myPublicKey: self.swskeypair.publicKey,
	    		mySecretKey: self.swskeypair.secretKey,
	    });
	    
	    self.bsrv.hpsrv.on('connection', function(client){	
	        console.log('new ws connection: ' +
	                    client.remoteAddress+':'+client.remotePort+' -> ' + 
	                    client.address().address+':'+client.address().port);
	    	
	    	// 1.2.2
	    	// send peer's connection info back
	        try {
	            var coninfo = {peeraddr: client.remoteAddress, peerport: client.remotePort};
	            
	            // V2 use msgpack
                client.send(MSGPACK.encode(coninfo), {binary: true, mask: false}, function(err){
                    if (err) {
                        console.log(err+',send peer info failed');
                    }
                });

                // 1.2.3
                // notes: force close hole after 10mins, TBD ...
                var clrtmo = null;
                if (self.keephole) {
                	if (Debug) 
                		console.log('keep connection of hole-punch server');
                } else {
                	clrtmo = setTimeout(function(){
    	        		if (client && client.close) client.close();

    	        		if (Debug) console.log('close connection of hole-punch server');
    	        	}, 620000);
                }
                
                client.on('error', function(err){
                    console.log(err+',hole-punch client failed');
                    
                    if (clrtmo) {
                        clearTimeout(clrtmo); clrtmo = null;
                    }
                });
                client.on('close', function(){
                	if (Debug) console.log('hole-punch client closed');

                	if (clrtmo) {
                		clearTimeout(clrtmo); clrtmo = null;
                	}
                });
            } catch (e) {
                console.log(e+',send peer info failed immediately');
            }
        });
	    
        if (Debug) console.log('business server started ...');
	}
    
    // 2.
    // fill dedicated ACL allow entry for turn-server
    DNS.lookup(self.srvinfo.turn[0].ip, function(err, address, family){
        if (err) {
            console.log(err+',dns lookup srvinfo failed');
            self.state = 'error';
            self.emit('error', err+',dns lookup srvinfo failed');
        } else {
            // 2.1
            // allow incoming connection from turn-server agent port
            self.allowAcl(address, self.srvinfo.turn[0].agent);
        }
    });
};

// Start heart-beat check timer
// notes: the algorithm is 
// - once ready or re-ready, launch heart-beat check timer
// - sending ping every 10s to primary name-server
// - if pong not back in 2s, increase heart-beat timeout, otherwise clear timeout
// - if heart-beat timeout exceed to 2, clear heart-beat timeout and trigger reconnect
// - repeat steps above
nmCln.prototype._LSM_startHeartbeat = function() {
    var self = this;

    
    // heart-beat timeout
    self.heartbeatTimeout = 0;
    
    // start heart-beat interval    
    self.heartbeatIntl = setInterval(function(){
        // send ping with 2s timeout
    	self.heartBeating(function(err, yes){
    	    if (!err && yes) {
    	    	self.heartbeatTimeout = 0;
    	    } else {
    	    	// increase heart-beat timeout
    	    	self.heartbeatTimeout ++;

    	    	// check timeout count
    	    	// TBD... optimizing timeout count
    	    	if (self.heartbeatTimeout > 2) {
    	    		if (Debug) console.log('Hear-beat check timeout '+self.heartbeatTimeout);

    	    		// clear interval
    	    		clearInterval(self.heartbeatIntl); self.heartbeatIntl = null;

    	    		// trigger reconnect event
    	    		if (self.state === 'ready') {
    	    			self.state = 'reconnecting';
    	    			self.emit('reconnect', 'heart-beat checking timeout');
    	    		}
    	    	}
    	    }
    	}, 2); // default 2s timeout    	
    }, 10000); // 10s heart-beating
};

// instance methods

// create connection to peer with c/s and p2p connection mode,
// if both peer behind the same nat/fw, connect to internal ip/port directly;
// TBD...support in case multiple-level internal NAT/FW.
// 
// notes: in p2p mode, set socket rendezvous option. 
// a timeout needed in secs
// to.endpoint: {ip:xxx, port:xxx}
// to.mode: connection mode c/s or p2p
// to.sesn: session mode stun or turn
// to.timeout: in seconds
nmCln.prototype.createConnection = function(to, fn){
    var self = this;
    var peer = to.endpoint;
    var opt = {httpp: true, hole: {port: self.port, addr: self.ipaddr}};
    var conn;
    
    
    // check session mode
    to.sesn = (to.sesn === undefined) ? SEP.SEP_SESN_STUN : to.sesn;
    
    // check connection mode
    if (to.mode === SEP.SEP_MODE_PP) {
        opt.hole.opt = {};
        opt.hole.opt.rendez = true;
    }
    
    // check security mode
    // notes: 
    // - enable token-based authentication on TURN session
    // - TBD... token-based authentication on STUN session
    var wstoken = (peer.secmode > SEP.SEP_SEC_SSL && to.sesn === SEP.SEP_SESN_TURN) ?
                  genvTokenStr(peer.vtoken) : '';
    
    var wsproto = peer.secmode ? 'wss://' : 'ws://';
    
    // set SSL related options
    if (self.secmode && self.secerts) {
        Object.keys(self.secerts).forEach(function(k){
            opt[k] = self.secerts[k];  
        });
    }
    
    // set NACL cert info
    opt.naclinfo = {
    	    version: 2,
      	       cert: self.swscert,
    	         ca: Naclcert.rootCACert,
    	requireCert: true,

    	myPublicKey: self.swskeypair.publicKey,
    	mySecretKey: self.swskeypair.secretKey,
    };
    
    if ((to.sesn === SEP.SEP_SESN_STUN) &&
        ((self.oipaddr === peer.ip) || (isLocalhost(self.oipaddr) && isLocalhost(peer.ip)))) {
        console.log('LAN direct connection...');
        
        conn = new SecureWebSocket(wsproto+peer.lip+':'+peer.lport+wstoken+SEP.SEP_CTRLPATH_BS, opt);
        console.log('connect to '+wsproto+peer.lip+':'+peer.lport+wstoken+SEP.SEP_CTRLPATH_BS);
    } else {
        // check vURL mode
        if (peer.vmode === vURL.URL_MODE_PATH) {
            // check session mode
            if (to.sesn === SEP.SEP_SESN_STUN) {
	            conn = new SecureWebSocket(wsproto+peer.ip+':'+peer.port+wstoken+SEP.SEP_CTRLPATH_BS, opt);
	            console.log('connect to '+wsproto+peer.ip+':'+peer.port+wstoken+SEP.SEP_CTRLPATH_BS);
            } else {
	            conn = new SecureWebSocket(wsproto+peer.ip+':'+peer.port+wstoken+peer.vpath+SEP.SEP_CTRLPATH_BS, opt);
	            console.log('connect to '+wsproto+peer.ip+':'+peer.port+wstoken+peer.vpath+SEP.SEP_CTRLPATH_BS);
            }
        } else {
            // check session mode
            if (to.sesn === SEP.SEP_SESN_STUN) {
                conn = new SecureWebSocket(wsproto+peer.ip+':'+peer.port+wstoken+SEP.SEP_CTRLPATH_BS, opt);
                console.log('connect to '+wsproto+peer.ip+':'+peer.port+wstoken+SEP.SEP_CTRLPATH_BS);
            } else {
                conn = new SecureWebSocket(wsproto+peer.vhost+peer.ip+':'+peer.port+wstoken+SEP.SEP_CTRLPATH_BS, opt);
                console.log('connect to '+wsproto+peer.vhost+peer.ip+':'+peer.port+wstoken+SEP.SEP_CTRLPATH_BS);
            }
        }
    }
    
    var t = setTimeout(function(){
        fn('connection timeout');
        conn.close();
    }, (to.timeout || 10)*1000); // 10s timeout in default
    
    conn.on('open', function(){
        clearTimeout(t);        
        fn(null, conn);
        
		// TBD... caching in memStore
		/*conn.peer = peer;
        self.peer[JSON.stringify(peer)] = {socket: conn, to: peer};
    */
        console.log('new peer connection in %s mode',
        (to.mode === SEP.SEP_MODE_PP) ? 'p2p' : 'c/s');
    });
    
    conn.on('error', function(err){               
        fn('new peer connection failure to '+JSON.stringify(peer)+err);
        console.error('new peer connection failure to '+JSON.stringify(peer)+err);
    });
    
    conn.on('close', function(){
    	// TBD...
	    /*if (self.peer[JSON.stringify(conn.peer)]) {
	        self.peer[JSON.stringify(conn.peer)] = null;
	    }*/
	    
	    if (Debug) console.log('new peer connection closed to '+JSON.stringify(peer));
    });
};

// punch hole to destination endpoint,
// if both peer behind the same nat/fw, using internal ip/port.
// TBD... multiple-level nat/fw
// notes: a timeout needed in secs
nmCln.prototype.punchHole = function(to, fn){
    var self = this;
    var peer = to.endpoint;
    var opt = {httpp: true, hole: {port: self.port, addr: self.ipaddr}};
    var hole;
    var endinfo;
    
    
    // 0.
    // calculate address info
    if (to.mode === SEP.SEP_MODE_PP) {
        opt.hole.opt = {};
        opt.hole.opt.rendez = true;
    }

    if (self.oipaddr === peer.ip) {
        endinfo = {
                    port: peer.lport,
                    host: peer.lip,
            localAddress: opt.hole
        };
    } else {
        endinfo = {
                    port: peer.port,
                    host: peer.ip,
            localAddress: opt.hole
        }
    }
    
    // Hole Punch algorithem
    // - if both side are asymmetric, punching each other with a few pacekt
    // - if only one side are asymmetric, punching from asymmetric only with a lot packet
    // - if both side are symmetric, going to TURN session anyway
        
    // 1.
	// punch hole with both asymmetric NAT/FW
    if (!(self.natype || peer.natype)) {
	    // 1.1
	    // allow ACL for peer
	    self.allowAcl(endinfo.host, endinfo.port);
	    
	    hole = UDT.createHole(endinfo);
		hole.punchhole(endinfo); // punch hole once
	
	    var intl = setInterval(function(){
	        hole.punchhole(endinfo);
	    }, 888); // punch hole about every 1s
	    console.log('punch hole: '+self.ipaddr+':'+self.port+' -> '+endinfo.host+':'+endinfo.port);
	    
	    // 1.2
	    // create keep-hole connection after 2s
	    setTimeout(function(){
	        // 1.2.1
	        // clear interval timer, then close hole soon after 2s
	        clearInterval(intl);
	        
	        // close hole
	        setTimeout(function(){
	            hole.destroy();
	        }, 2000); // after 2s in default
	        
	        // 1.3
	        // setup keep-hole connection
	        // only do this step from Initiator
	        if (to.isInitiator) {
		        var conn;
		        var wsproto = peer.secmode ? 'wss://' : 'ws://';
		        
			    // set SSL related options
			    if (self.secmode && self.secerts) {
			        Object.keys(self.secerts).forEach(function(k){
			            opt[k] = self.secerts[k];  
			        });
			    }
			    
			    // set NACL cert info
			    opt.naclinfo = {
			    	    version: 2,
			      	       cert: self.swscert,
			    	         ca: Naclcert.rootCACert,
			    	requireCert: true,

			    	myPublicKey: self.swskeypair.publicKey,
			    	mySecretKey: self.swskeypair.secretKey,
			    };
			    
		        if ((self.oipaddr === peer.ip) || 
	                (isLocalhost(self.oipaddr) && isLocalhost(peer.ip))) {
		            conn = new SecureWebSocket(wsproto+peer.lip+':'+peer.lport+SEP.SEP_CTRLPATH_HS, opt);
		        } else {
		            conn = new SecureWebSocket(wsproto+peer.ip+':'+peer.port+SEP.SEP_CTRLPATH_HS, opt);
		        }
		    
		        var t = setTimeout(function(){
		            fn('punch hole timeout');
		            conn.close();
		            console.log('punch hole timeout in %s mode from %s',
		            (to.mode === SEP.SEP_MODE_PP) ? 'p2p' : 'c/s',
				    (to.isInitiator)? 'initiator' : 'peer');
		        }, (to.timeout || 6)*1000); // 6s timeout in default
		    
		        conn.on('open', function(){
		            clearTimeout(t);
		            
		            console.log('punch hole successfully in %s mode from %s',
		            (to.mode === SEP.SEP_MODE_PP) ? 'p2p' : 'c/s',
				    (to.isInitiator)? 'initiator' : 'peer');
		        });
		    
		        conn.once('message', function(message, flags) {
		            if (Debug) console.log('punch hole notification messaging in %s mode from %s',
		            (to.mode === SEP.SEP_MODE_PP) ? 'p2p' : 'c/s',
				    (to.isInitiator)? 'initiator' : 'peer');
				    
				    var coninfo = (flags.binary) ? MSGPACK.decode(message) : JSON.parse(message);
				    
		            // 1.3.1
		            // pass connection external ip/port info back to name-server
		            fn(null, {moaddr: coninfo.peerip,     moport: coninfo.peerport,
		                      poaddr: conn.remoteAddress, poport: conn.remotePort});
				    
		            // 1.3.2
		            // maintain or close hole-punch connection
		            // close keep-hole connection after 6s
		            if (self.trvsStunCache[peer.vhost] || 
		            	self.trvsStunCache[peer.vpath]) {
		            	// check stun session count
		            	if (self.trvsStunCache[peer.vhost]) {
		            		self.trvsStunCache[peer.vhost].stun_count ++;
		            		
		            		if (Debug) 
		            			console.log(peer.vhost+': increase stun count to '+self.trvsStunCache[peer.vhost].stun_count);

		            		setTimeout(function(){
		            			if (conn && conn.close) conn.close()
		            		}, 6000);
		            	}

		            	if (self.trvsStunCache[peer.vpath]) {
		            		self.trvsStunCache[peer.vpath].stun_count ++;
		            		
		            		if (Debug) 
		            			console.log(peer.vpath+': increase stun count to '+self.trvsStunCache[peer.vpath].stun_count);

		            		setTimeout(function(){
		            			if (conn && conn.close) conn.close()
		            		}, 6000);
		            	}
		            } else {
		            	if (self.keephole) {
		            		if (Debug) 
		            			console.log(peer.vpath+': keep hole');
		            	} else {
		            		// notes: force close hole after 10mins, TBD ...
		            		setTimeout(function(){
		            			if (conn && conn.close) conn.close()
		            		}, 600000);
		            	}

		            	// record hole-keep connection
		            	conn.peer = peer;
		            	self.hole[JSON.stringify(peer)] = {socket: conn, to: peer};
		            }
		        });
		   
		        conn.on('error', function(err){
		            clearTimeout(t); 
		            fn('punch hole error', 0);
		            conn.close();
		        
		            console.log('punch hole error %s in %s mode from %s', err,
		            (to.mode === SEP.SEP_MODE_PP) ? 'p2p' : 'c/s',
				    (to.isInitiator)? 'initiator' : 'peer');
		        });
		   
		        conn.on('close', function(){
		        	if (Debug) 
		        		console.log('punch hole closed in %s mode from %s',
		        	                (to.mode === SEP.SEP_MODE_PP) ? 'p2p' : 'c/s',
		                            (to.isInitiator)? 'initiator' : 'peer');

		        	// clear keep-hole cache
		        	// TBD...
		        	if (self.trvsStunCache[peer.vhost] || 
		        		self.trvsStunCache[peer.vpath]) {
		        		// check stun session count
		        		if (self.trvsStunCache[peer.vhost]) {
		        			self.trvsStunCache[peer.vhost].stun_count --;
		        			
		        			if (Debug) 
		        				console.log(peer.vhost+': decrease stun count to '+self.trvsStunCache[peer.vhost].stun_count);
		        			
		        			if (self.trvsStunCache[peer.vhost].stun_count === 0) {
		        				self.trvsStunCache[peer.vhost] = null;
		        				
		        				if (Debug) 
		        					console.log(peer.vhost+': clear stun session ');
		        			}
		        		}

		        		if (self.trvsStunCache[peer.vpath]) {
		        			self.trvsStunCache[peer.vpath].stun_count --;
		        			
		        			if (Debug) 
		        				console.log(peer.vpath+': decrease stun count to '+self.trvsStunCache[peer.vpath].stun_count);

		        			if (self.trvsStunCache[peer.vpath].stun_count === 0) {
		        				self.trvsStunCache[peer.vpath] = null;
		        				
		        				if (Debug) 
		        					console.log(peer.vpath+': clear stun session');
		        			}
		        		}
		        	} 
		        });
		    }
	    }, 2000); // 2s timeout
    } else if (self.natype || peer.natype) {
        // 2.
        // punch hole with one asymmetric NAT/FW, while peer symmetric NAT/FW
        
        if (self.natype) {
            // 2.1
            // symmetric side algorithem:
            // - allow incomming wss connection from peer
            // - open udp port hole for peer
            // - waiting peer open all udp port hole
            // - setup wss connection to peer
            // - setup keep-hole connection to peer
            
            // 2.1.1
            // allow ACL for peer
	        self.allowAcl(endinfo.host, endinfo.port);
	        
	        // 2.1.2
	        // open hole to peer
	        hole = UDT.createHole(endinfo);
		    hole.punchhole(endinfo); // punch hole once
	
		    var intl = setInterval(function(){
		        hole.punchhole(endinfo);
		    }, 888); // punch hole about every 1s
		    console.log('punch hole @symmetric: '+self.ipaddr+':'+self.port+' -> '+endinfo.host+':'+endinfo.port);
	        
		    // 2.1.3
		    // create keep-hole connection after 6.666s, which MUST ~> peer's hole-punch timeout(6s)
		    setTimeout(function(){
		    
		        // 2.1.3.1
		        // clear interval, then close hole soon after 2s
		        clearInterval(intl);
		    
		        // close hole
		        setTimeout(function(){
		            hole.destroy();
		        }, 2000); // after 2s in default
		        
		        // 2.1.4
		        // setup hole-punch connection and maitain it in case Initiator
		        var conn;
		        var wsproto = peer.secmode ? 'wss://' : 'ws://';
		        
			    // set SSL related options
			    if (self.secmode && self.secerts) {
			        Object.keys(self.secerts).forEach(function(k){
			            opt[k] = self.secerts[k];  
			        });
			    }
			    
			    // set NACL cert info
			    opt.naclinfo = {
			    	    version: 2,
			      	       cert: self.swscert,
			    	         ca: Naclcert.rootCACert,
			    	requireCert: true,

			    	myPublicKey: self.swskeypair.publicKey,
			    	mySecretKey: self.swskeypair.secretKey,
			    };
			    
		        if ((self.oipaddr === peer.ip) || 
	                (isLocalhost(self.oipaddr) && isLocalhost(peer.ip))) {
		            conn = new SecureWebSocket(wsproto+peer.lip+':'+peer.lport+SEP.SEP_CTRLPATH_HS, opt);
		        } else {
		            conn = new SecureWebSocket(wsproto+peer.ip+':'+peer.port+SEP.SEP_CTRLPATH_HS, opt);
		        }
		        
		        var t = setTimeout(function(){
		            fn('punch hole timeout');
		            conn.close();
		            console.log('punch hole timeout in %s mode from %s @symmetric',
		            (to.mode === SEP.SEP_MODE_PP) ? 'p2p' : 'c/s',
				    (to.isInitiator)? 'initiator' : 'peer');
		        }, (to.timeout || 6)*1000); // 6s timeout in default
		        
		        conn.on('open', function(){
		            clearTimeout(t);
		            
		            console.log('punch hole successfully in %s mode from %s @symmetric',
		            (to.mode === SEP.SEP_MODE_PP) ? 'p2p' : 'c/s',
				    (to.isInitiator)? 'initiator' : 'peer');
		        });
		        
		        conn.once('message', function(message, flags) {
		            if (Debug) console.log('punch hole notification messaging in %s mode from %s @symmetric',
		            (to.mode === SEP.SEP_MODE_PP) ? 'p2p' : 'c/s',
				    (to.isInitiator)? 'initiator' : 'peer');
				    
				    var coninfo = (flags.binary) ? MSGPACK.decode(message) : JSON.parse(message);
				    
		            // 2.1.4.1
		            // pass connection external ip/port info back to name-server
		            fn(null, {moaddr: coninfo.peerip,     moport: coninfo.peerport,
		                      poaddr: conn.remoteAddress, poport: conn.remotePort});
				    
				    // 2.1.4.2
				    // maintain or close hole-punch connection
		            // close keep-hole connection after 6s
		            if (self.trvsStunCache[peer.vhost] || 
		            	self.trvsStunCache[peer.vpath]) {
		            	// check stun session count
		            	if (self.trvsStunCache[peer.vhost]) {
		            		self.trvsStunCache[peer.vhost].stun_count ++;
		            		
		            		if (Debug) 
		            			console.log(peer.vhost+': increase stun count to '+self.trvsStunCache[peer.vhost].stun_count);

		            		setTimeout(function(){
		            			if (conn && conn.close) conn.close()
		            		}, 6000);
		            	}

		            	if (self.trvsStunCache[peer.vpath]) {
		            		self.trvsStunCache[peer.vpath].stun_count ++;
		            		
		            		if (Debug) 
		            			console.log(peer.vpath+': increase stun count to '+self.trvsStunCache[peer.vpath].stun_count);

		            		setTimeout(function(){
		            			if (conn && conn.close) conn.close()
		            		}, 6000);
		            	}
		            } else {
		            	if (self.keephole) {
		            		if (Debug) 
		            			console.log(peer.vpath+': keep hole');
		            	} else {
		            		// notes: force close hole after 10mins, TBD ...
		            		setTimeout(function(){
		            			if (conn && conn.close) conn.close()
		            		}, 600000);
		            	}
		            	
		            	// record hole-keep connection
		            	conn.peer = peer;
		            	self.hole[JSON.stringify(peer)] = {socket: conn, to: peer};
		            }
		        });
		   
		        conn.on('error', function(err){
		            clearTimeout(t); 
		            fn('punch hole error');
		            conn.close();
		        
		            console.log('punch hole error %s in %s mode from %s @symmetric', err,
		            (to.mode === SEP.SEP_MODE_PP) ? 'p2p' : 'c/s',
				    (to.isInitiator)? 'initiator' : 'peer');
		        });
		   
		        conn.on('close', function(){
		        	if (Debug) 
		        		console.log('punch hole closed in %s mode from %s @symmetric',
		        				    (to.mode === SEP.SEP_MODE_PP) ? 'p2p' : 'c/s',
		        				    (to.isInitiator)? 'initiator' : 'peer');

		        	// clear keep-hole cache
		        	// TBD...
		        	if (self.trvsStunCache[peer.vhost] || 
		        		self.trvsStunCache[peer.vpath]) {
		        		// check stun session count
		        		if (self.trvsStunCache[peer.vhost]) {
		        			self.trvsStunCache[peer.vhost].stun_count --;
		        			
		        			if (Debug) 
		        				console.log(peer.vhost+': decrease stun count to '+self.trvsStunCache[peer.vhost].stun_count);
		        			
		        			if (self.trvsStunCache[peer.vhost].stun_count === 0) {
		        				self.trvsStunCache[peer.vhost] = null;
		        				
		        				if (Debug) 
		        					console.log(peer.vhost+': clear stun session ');
		        			}
		        		}

		        		if (self.trvsStunCache[peer.vpath]) {
		        			self.trvsStunCache[peer.vpath].stun_count --;
		        			
		        			if (Debug) 
		        				console.log(peer.vpath+': decrease stun count to '+self.trvsStunCache[peer.vpath].stun_count);

		        			if (self.trvsStunCache[peer.vpath].stun_count === 0) {
		        				self.trvsStunCache[peer.vpath] = null;
		        				
		        				if (Debug) 
		        					console.log(peer.vpath+': clear stun session');
		        			}
		        		}
		        	} 
		        });
		        
		    }, 6666); // ~>6s timeout
	    
        } else {
	        // 2.2
	        // asymmetric side algorithem:
	        // - allow all incomming wss connection from peer
	        // - open all udp port hole for peer
	        // - waiting for wss connection from peer
	        // - got wss connection from peer and record peer's external source ip/port
	        // - send peer's external source ip/port back via hole-punch server
	        // ...
	        // - port allocation schema
		    // --      0-1023: Well-known ports
		    // --  1024-49151: Registered ports
		    // -- 49152-65535: Dynamic, private or ephemeral ports
    
            // 2.2.1
            // allow ACL for peer's dynamic port range TBD...
            ///for (var dport = ; dport <= ; dport ++) 
	            self.allowAcl(endinfo.host, 0);
	        
	        // 2.1.2
	        // open hole to peer's dynamic port range
	        hole = UDT.createHole(endinfo);
	        endinfo.localAddress = endinfo.localAddress || {};
	        endinfo.port = 49152;
	        endinfo.localAddress.holeRange = {from: 0, to: 65535 - 49152};
		    hole.punchhole(endinfo); // punch hole once
	
		    var intl = setInterval(function(){
		        ///hole.punchhole(endinfo);
		    }, 2888); // punch hole about every 3s
		    console.log('punch hole: '+self.ipaddr+':'+self.port+' -> '+endinfo.host+':'+endinfo.port+' @asymmetric');
	        
		    // 2.1.3
		    // stop hole punching after 6s
		    setTimeout(function(){
		    
		        // 2.1.3.1
		        // clear interval, then close hole soon after 2s
		        clearInterval(intl);
		    
		        // close hole
		        setTimeout(function(){
		            hole.destroy();
		        }, 2000); // after 2s in default
		        
		    }, 6000); // 6s timeout
		    	        
        }
    } else {
        // 3.
        // punch hole with both symmetric NAT/FW
        // Don't support it
        fn('Not support');
    }
};

// ask for sdp info, then wait for sdp answer message
// notes: put timeout(in seconds) in second paramter
nmCln.prototype.offerSdp = function(fn, tmo){
    var self = this;
    
    // callback event count
    self.clntsdpanswerCbCnt = self.clntsdpanswerCbCnt || 0;
    
    // 0.
    // clear previous SDP session cache
    if (self.offans_sdp && self.offans_sdp.length) {
        self.offans_sdp = [];
    }
    
    // 1.
    // added SDP event listener with timeout
    var t = setTimeout(function(){
	    self.removeAllListeners('clntsdpanswer'+self.clntsdpanswerCbCnt);
        fn('offerSdp timeout');
    }, (tmo || 60)*1000); // 60s timeout in default
    
    ///console.log('pre-event:'+'clntsdpanswer'+self.clntsdpanswerCbCnt);
    self.once('clntsdpanswer'+self.clntsdpanswerCbCnt, function(sdp){
        ///console.log('after-event:'+'clntsdpanswer'+self.clntsdpanswerCbCnt);
        
        clearTimeout(t);
        
        if (sdp.err) {
            fn(sdp.err+',offer sdp failed');
        } else {
            fn(null, sdp);
        }
    });

    // 2.
    // fill SDP offer message
    var opc_msg = {};
    opc_msg.opc = SEP.SEP_OPC_SDP_OFFER;
    
    // 2.0
    // !!! place callback count in message context
    opc_msg.evcbcnt = self.clntsdpanswerCbCnt++;
                    
    // 2.1
    // fill SDP session info got by client
    opc_msg.offer = {
        // protocol info
    	version       : 2,
        proto         : 'udp',
        naclpublickey : self.swspublickey,
        
        // connection/security mode
        conmode       : self.conmode,
        vmode         : self.vmode,
        secmode       : self.secmode,
        vtoken        : self.vtoken,
        
        // client/device/user info
        clntgid       : self.gid,
        clntlocalIP   : self.ipaddr,
        clntlocalPort : self.port,
        devkey        : (self.devinfo && self.devinfo.devkey) || 'iloveyou',
        domain        : (self.usrinfo && self.usrinfo.domain) || '51dese.com',
        usrkey        : (self.usrinfo && self.usrinfo.usrkey) || 'tomzhou',
        
        // TURN agent session state
        turnagentReady: self.turnagentReady || false,
                        
        // timestamp on session start and done
        // TBD... round trip timestamp
        ///stamp_start  : Date.now()
        start         : Date.now()
    };
    
    // 3.
    // send opc in all connections
    for (var k in self.conn) {
        // fill connection-specific info
        opc_msg.offer.srvpublicIP   = self.conn[k].to.ip;
        opc_msg.offer.srvpublicPort = self.conn[k].to.port;
        
        // offer message count as sequence number
        opc_msg.seqno = self.conn[k].socket.offerMsgcnt++;
        
        try {
        	// V2 use msgpack
            self.conn[k].socket.send(MSGPACK.encode(opc_msg), {binary: true, mask: false}, function(err){
                if (err) console.log(err+',send sdp info failed');
            });
        } catch (e) {
            console.log(e+',send sdp info failed immediately');
        }
    }
};

// update client NAT type info
nmCln.prototype.updateNatype = function(fn, tmo){
    var self = this;
    
    // callback event count
    self.clntnatypeanswerCbCnt = self.clntnatypeanswerCbCnt || 0;

    // 1.
    // added clntnatype event listener with timeout
    var t = setTimeout(function(){
	    self.removeAllListeners('clntnatypeanswer'+self.clntnatypeanswerCbCnt);
        fn('updateNatype timeout');
    }, (tmo || 60)*1000); // 60s timeout in default
    
    self.once('clntnatypeanswer'+self.clntnatypeanswerCbCnt, function(err){
        clearTimeout(t);

        if (err) {
            fn(err+',update client natype info failed');
        } else {
            fn(null);
        }
    });
    
    // 2.
    // fill NAT type offer message
    var opc_msg = {};
    opc_msg.opc = SEP.SEP_OPC_NAT_OFFER;
    
    // 2.0
    // !!! place callback count in message context
    opc_msg.evcbcnt = self.clntnatypeanswerCbCnt++;
 
    // 2.1
    // fill  NAT type info with client
    opc_msg.offer = {
           gid: self.offans_sdp[0].answer.client.gid,
        natype: self.natype
    };
    
    // 3.
    // send opc 
    self.sendOpcMsg(opc_msg, function(err){
        if (err) fn(err+',updateNatype failed'); 
    }); 
    
    return self;
};

// send heart-beat ping request, then got pong response
// - tmo: timeout
nmCln.prototype.heartBeating = function(fn, tmo){
    var self = this;
    
    // callback event count
    self.clntheartbeatanswerCbCnt = self.clntheartbeatanswerCbCnt || 0;

    // 1.
    // added clntheartbeat event listener with timeout
    var t = setTimeout(function(){
	    self.removeAllListeners('clntheartbeatanswer'+self.clntheartbeatanswerCbCnt);
        fn('heartBeating timeout', false);
    }, (tmo || 60)*1000); // 60s timeout in default
    
    self.once('clntheartbeatanswer'+self.clntheartbeatanswerCbCnt, function(err){
        clearTimeout(t);

        if (err) {
            fn(err+',heartBeating request failed', false);
        } else {
            fn(null, true);
        }
    });
    
    try {
    	// 2.
    	// fill heartBeating offer message
    	var opc_msg = {};
    	opc_msg.opc = SEP.SEP_OPC_HEART_BEAT_OFFER;

    	// 2.0
    	// !!! place callback count in message context
    	opc_msg.evcbcnt = self.clntheartbeatanswerCbCnt++;

    	// 2.1
    	// fill heartBeating info with client    
    	opc_msg.offer = {
    			gid: self.offans_sdp[0].answer.client.gid,
    			timeAt: Date.now()
    	};

    	// 3.
    	// send opc 
    	self.sendOpcMsg(opc_msg, function(err){
    		if (err) fn(err+',heartBeating failed', false); 
    	}); 
    } catch (e) {
        fn(e+',heartBeating sendOpcMsg exception', false); 
    }
    
    return self;
};

// ask for stun info, then wait for stun answer message
// notes: put timeout(in seconds) in second paramter
// peer: destination client info
nmCln.prototype.offerStun = function(peer, fn, tmo){
    var self = this;
    
    // support both async and either async NAT/FW
    if (self.natype && peer.natype) {
        fn('Not support both are sync NAT/FW');
        return self;
    }
    
    // !!! allow ACL for peer
    self.allowAcl(peer.endpoint.ip, peer.endpoint.port);
    
    // callback event count
    self.clntstunanswerCbCnt = self.clntstunanswerCbCnt || 0;

    // 1.
    // added clntstunanswer event listener with timeout
    var t = setTimeout(function(){
	    self.removeAllListeners('clntstunanswer'+self.clntstunanswerCbCnt);
        fn('offerStun timeout');
    }, (tmo || 20)*1000); // 20s timeout in default
    
    self.once('clntstunanswer'+self.clntstunanswerCbCnt, function(stun){
        clearTimeout(t);

        if (stun.err) {
            fn(stun.err+',offerStun failed');
        } else {
            fn(null, stun);
        }
    });
    
    // 2.
    // fill STUN offer message
    var opc_msg = {};
    opc_msg.opc = SEP.SEP_OPC_STUN_OFFER;
    
    // 2.0
    // !!! place callback count in message context
    opc_msg.evcbcnt = self.clntstunanswerCbCnt++;
 
    // 2.1
    // fill STUN info with client ip/port
    var mine = {        
         natype: self.natype,
            gid: self.gid,
          vpath: self.vpath,
          vhost: self.vhost,
          vmode: self.vmode,
         vtoken: self.vtoken,
        secmode: self.secmode,
               
          port: self.oport,
            ip: self.oipaddr,
            
         lport: self.port,
           lip: self.ipaddr,
           
       usrinfo: self.usrinfo
    };
    var peer = {
         natype: peer.endpoint.natype,
            gid: peer.endpoint.gid,
          vpath: peer.endpoint.vpath,
          vhost: peer.endpoint.vhost,
          vmode: peer.endpoint.vmode,
         vtoken: peer.endpoint.vtoken,
        secmode: self.secmode,
          
           port: peer.endpoint.port,
             ip: peer.endpoint.ip,
            
          lport: peer.endpoint.lport,
            lip: peer.endpoint.lip
    };
    opc_msg.offer = {mine: mine, peer: peer, mode: self.conmode};
    
    // 3.
    // send opc 
    self.sendOpcMsg(opc_msg, function(err){
        if (err) fn(err+',offerStun failed'); 
    });
    
    return self;
};

// ask for turn info, then wait for turn answer message
// notes: put timeout(in seconds) in second paramter
// peer: destination client info
nmCln.prototype.offerTurn = function(peer, fn, tmo){
    var self = this;
    
    
    // callback event count
    self.clntturnanswerCbCnt = self.clntturnanswerCbCnt || 0;

    // 1.
    // added clntturnanswer event listener with timeout
    var t = setTimeout(function(){
	    self.removeAllListeners('clntturnanswer'+self.clntturnanswerCbCnt);
        fn('offerTurn timeout');
    }, (tmo || 20)*1000); // 20s timeout in default
    
    self.once('clntturnanswer'+self.clntturnanswerCbCnt, function(turn){
        clearTimeout(t);

        if (turn.err) {
            fn(turn.err+',offerTurn failed');
        } else {
            fn(null, turn);
        }
    });
    
    // 2.
    // fill TURN offer message
    var opc_msg = {};
    opc_msg.opc = SEP.SEP_OPC_TURN_OFFER;
    
    // 2.0
    // !!! place callback count in message context
    opc_msg.evcbcnt = self.clntturnanswerCbCnt++;
 
    // 2.1
    // fill TURN info with client ip/port
    var mine = {   		
         natype: self.natype,
            gid: self.gid,
          vpath: self.vpath,
          vhost: self.vhost,
          vmode: self.vmode,
         vtoken: self.vtoken,
        secmode: self.secmode,
        
           port: self.oport,
             ip: self.oipaddr,
             
          lport: self.port,
            lip: self.ipaddr,
            
        usrinfo: self.usrinfo   
    };
    var peer = {    		
         natype: peer.endpoint.natype,
            gid: peer.endpoint.gid,
          vpath: peer.endpoint.vpath,
          vhost: peer.endpoint.vhost,
          vmode: peer.endpoint.vmode,
         vtoken: peer.endpoint.vtoken,
        secmode: self.secmode,
          
           port: peer.endpoint.port,
             ip: peer.endpoint.ip,
            
          lport: peer.endpoint.lport,
            lip: peer.endpoint.lip
    };
    opc_msg.offer = {mine: mine, peer: peer, mode: self.conmode};
    
    // 3.
    // send opc 
    self.sendOpcMsg(opc_msg, function(err){
        if (err) fn(err+',offerTurn failed'); 
    });
    
    return self;
};

// send opc msg to the first name-server
nmCln.prototype.sendOpcMsg = function(opc_msg, fn){
	var self = this;
	var con0 = JSON.stringify(self.srvs[0]); // connection to the first name-server

	// check connection status
	if (self.conn[con0] && self.conn[con0].socket) {    
		// send opc message
		try {
			// fill offer message count as sequence number
			opc_msg.seqno = self.conn[con0].socket.offerMsgcnt++;
			
        	// V2 use msgpack
			self.conn[con0].socket.send(MSGPACK.encode(opc_msg), {binary: true, mask: false}, function(err){
				if (err) {
					console.log(err+',sendOpcMsg failed');
					if (fn) fn(err+',sendOpcMsg failed');
				} else {
					if (fn) fn(null);
				}
			});
		} catch (e) {
			console.log(e+',sendOpcMsg failed immediately');
			if (fn) fn(e+',sendOpcMsg failed immediately');
		}
	} else {
		// algorithem:
		// 1. try to reconnect in case ready state
		// 2. waiting for on fly reconnecting 
		if (self.state === 'ready' ||
			self.state === 'reconnecting') {
			// delayed sendOpcMsg execution once reready
			var dt = setTimeout(function(){
				console.log('sendOpcMsg reconnect broken after 6s');
				if (fn) fn('sendOpcMsg reconnect broken after 6s');
			}, 6000); // 6s timeout
			self.once('reready', function(){
				clearTimeout(dt);

				console.log('sendOpcMsg delayed execute');
				self.sendOpcMsg(opc_msg, fn);
			});

			// trigger reconnect event
			if (self.state === 'ready') {
				self.state = 'reconnecting';
				self.emit('reconnect', 'sendOpcMsg connection broken');
			}
		} else {
			console.log('sendOpcMsg failed unexpected');
			if (fn) fn('sendOpcMsg failed unexpected');
		}
	}

	return self;
};

// get sdp info
nmCln.prototype.getClntSdps = function(clntinfo, fn, tmo){
    var self = this;
    
    // callback event count
    self.clntsdpsCbCnt = self.clntsdpsCbCnt || 0;

    // 1.
    // added clntsdps event listener with timeout
    var t = setTimeout(function(){
	    self.removeAllListeners('clntsdps'+self.clntsdpsCbCnt);
        fn('getClntSdps timeout');
    }, (tmo || 60)*1000); // 60s timeout in default
    
    self.once('clntsdps'+self.clntsdpsCbCnt, function(sdps){
        clearTimeout(t);

        if (sdps.err) {
            fn(sdps.err+',get client sdp info failed');
        } else {
            fn(null, sdps);
        }
    });
    
    // 2.
    // fill CLNT-SDPS offer message
    var opc_msg = {};
    opc_msg.opc = SEP.SEP_OPC_CLNT_SDP_OFFER;
    
    // 2.0
    // !!! place callback count in message context
    opc_msg.evcbcnt = self.clntsdpsCbCnt++;
 
    // 2.1
    // fill CLNT-SDPS sdp info with client
    opc_msg.offer = {
        mine: self.usrinfo,
        clnt: clntinfo
    };
    
    // 3.
    // send opc 
    self.sendOpcMsg(opc_msg, function(err){
        if (err) fn(err+',getClntSdps failed'); 
    }); 
    
    return self;
};

// get peer's login info
nmCln.prototype.getUsrLogins = function(usrinfo, fn, tmo){
    var self = this;
    
    // callback event count
    self.usrloginsCbCnt = self.usrloginsCbCnt || 0;

    // 1.
    // added alllogin event listener with timeout
    var t = setTimeout(function(){
	    self.removeAllListeners('usrlogins'+self.usrloginsCbCnt);
        fn('getUsrLogins timeout');
    }, (tmo || 60)*1000); // 60s timeout in default
    
    self.once('usrlogins'+self.usrloginsCbCnt, function(logins){
        clearTimeout(t);

        if (logins.err) {
            fn(logins.err+',get peer login info failed');
        } else {
            fn(null, logins);
        }
    });
    
    // 2.
    // fill USR-LOGINS offer message
    var opc_msg = {};
    opc_msg.opc = SEP.SEP_OPC_USR_LOGIN_OFFER;
    
    // 2.0
    // !!! place callback count in message context
    opc_msg.evcbcnt = self.usrloginsCbCnt++;

    // 2.1
    // fill USR-LOGINS user info with client
    opc_msg.offer = {
        mine: self.usrinfo,
        peer: usrinfo
    };
    
    // 3.
    // send opc 
    self.sendOpcMsg(opc_msg, function(err){
        if (err) fn(err+',getUsrLogins failed'); 
    }); 
    
    return self;
};

// disable on server side by now
nmCln.prototype.getAllLogins = function(fn, tmo){
    var self = this;
    
    // callback event count
    self.allloginsCbCnt = self.allloginsCbCnt || 0;

    // 1.
    // added alllogin event listener with timeout
    var t = setTimeout(function(){
	    self.removeAllListeners('alllogins'+self.allloginsCbCnt);
        fn('getAllLogins timeout');
    }, (tmo || 60)*1000); // 60s timeout in default
    
    self.once('alllogins'+self.allloginsCbCnt, function(logins){
        clearTimeout(t);

        if (logins.err) {
            fn(logins.err+',get all logins failed');
        } else {
            fn(null, logins);
        }
    });

    // 2.
    // fill ALL-LOGINS offer message
    var opc_msg = {};
    opc_msg.opc = SEP.SEP_OPC_ALL_LOGIN_OFFER;
    
    // 2.0
    // !!! place callback count in message context
    opc_msg.evcbcnt = self.allloginsCbCnt++;

    // 2.1
    // fill ALL-LOGINS user info with client
    opc_msg.offer = {
        mine: self.usrinfo
    };
    
    // 3.
    // send opc 
    self.sendOpcMsg(opc_msg, function(err){
        if (err) fn(err+',getAllLogins failed'); 
    }); 
    
    return self;   
};

// get user info
// TBD... ACL logic, disable on server side by now
nmCln.prototype.getAllUsrs = function(fn, tmo){
    var self = this;
    
    // callback event count
    self.allusrsCbCnt = self.allusrsCbCnt || 0;

    // 1.
    // added allusrs event listener with timeout
    var t = setTimeout(function(){
	    self.removeAllListeners('allusrs'+self.allusrsCbCnt);
        fn('getAllUsrs timeout');
    }, (tmo || 60)*1000); // 60s timeout in default
    
    self.once('allusrs'+self.allusrsCbCnt, function(usrs){
        clearTimeout(t);

        if (usrs.err) {
            fn(usrs.err+',get all users failed');
        } else {
            fn(null, usrs);
        }
    });

    // 2.
    // fill ALL-USR offer message
    var opc_msg = {};
    opc_msg.opc = SEP.SEP_OPC_ALL_USR_OFFER;
    
    // 2.0
    // !!! place callback count in message context
    opc_msg.evcbcnt = self.allusrsCbCnt++;

    // 2.1
    // fill ALL-USR user info with client
    opc_msg.offer = {
        mine: self.usrinfo
    };
    
    // 3.
    // send opc 
    self.sendOpcMsg(opc_msg, function(err){
        if (err) fn(err+',getAllUsrs failed'); 
    });    
    
    return self;
};

// report peer service
// notes: service obj like:
// - {peerid:x,who:x,when:x,where:x,vurl:x,cate:x,name:x,desc:x,tags:x,state:x,acls:x,accounting:x,meta:x}
// - peerid,who,vurl,cate is MUSTed, and peerid will be added in server side
nmCln.prototype.reportService = function(srv, fn, tmo){
    var self = this;
    
    // callback event count
    self.reportsrvCbCnt = self.reportsrvCbCnt || 0;

    // 1.
    // added event listener with timeout
    var t = setTimeout(function(){
	    self.removeAllListeners('reportsrv'+self.reportsrvCbCnt);
        if (fn) fn('reportService timeout');
    }, (tmo || 60)*1000); // 60s timeout in default
    
    self.once('reportsrv'+self.reportsrvCbCnt, function(srv){
        clearTimeout(t);

        if (srv.err) {
            if (fn) fn(srv.err+',report service failed');
        } else {
            if (fn) fn(null, srv);
        }
    });

    // 2.
    // fill offer message
    var opc_msg = {};
    opc_msg.opc = SEP.SEP_OPC_SRV_REPORT_OFFER;
    
    // 2.0
    // !!! place callback count in message context
    opc_msg.evcbcnt = self.reportsrvCbCnt++;

    // 2.1
    // fill service info, check default parameters
    srv.domain = srv.domain || self.usrinfo.domain;
    srv.usrkey = srv.usrkey || self.usrinfo.usrkey;
    srv.vurl   = srv.vurl   || self.vurl;
    srv.timeAt = Date.now();
    ///srv.geosAt  = ; // TBD...
    opc_msg.offer = {
        srv: srv
    };
    if (Debug) console.log('reported service:'+JSON.stringify(srv));
    
    // 3.
    // send opc 
    self.sendOpcMsg(opc_msg, function(err){
        if (err && fn) fn(err+',reportService failed'); 
    });
    
    return self;
};

// update peer service
// notes: service obj like:
// - {peerid:x,who:x,when:x,where:x,vurl:x,cate:x,name:x,desc:x,tags:x,state:x,acls:x,accounting:x,meta:x}
// - peerid,who,vurl,cate is MUSTed, and peerid will be added in server side
nmCln.prototype.updateService = function(srv, fn, tmo){
    var self = this;
    
    // callback event count
    self.updatesrvCbCnt = self.updatesrvCbCnt || 0;

    // 1.
    // added event listener with timeout
    var t = setTimeout(function(){
	    self.removeAllListeners('updatesrv'+self.updatesrvCbCnt);
        if (fn) fn('updateService timeout');
    }, (tmo || 60)*1000); // 60s timeout in default
    
    self.once('updatesrv'+self.updatesrvCbCnt, function(srv){
        clearTimeout(t);

        if (srv.err) {
            if (fn) fn(srv.err+',update service failed');
        } else {
            if (fn) fn(null, srv);
        }
    });

    // 2.
    // fill offer message
    var opc_msg = {};
    opc_msg.opc = SEP.SEP_OPC_SRV_UPDATE_OFFER;
    
    // 2.0
    // !!! place callback count in message context
    opc_msg.evcbcnt = self.updatesrvCbCnt++;

    // 2.1
    // fill service info, check default parameters
    srv.domain = srv.domain || self.usrinfo.domain;
    srv.usrkey = srv.usrkey || self.usrinfo.usrkey;
    srv.vurl   = srv.vurl   || self.vurl;
    srv.timeAt = Date.now();
    ///srv.geosAt  = ; // TBD...
    opc_msg.offer = {
        srv: srv
    };
    if (Debug) console.log('updated service:'+JSON.stringify(srv));
    
    // 3.
    // send opc 
    self.sendOpcMsg(opc_msg, function(err){
        if (err && fn) fn(err+',updateService failed'); 
    });
    
    return self;    
};

// query peer service
nmCln.prototype.queryService = function(srv, fn, tmo){
    var self = this;
    
    // callback event count
    self.querysrvCbCnt = self.querysrvCbCnt || 0;

    // 1.
    // added event listener with timeout
    var t = setTimeout(function(){
	    self.removeAllListeners('querysrv'+self.querysrvCbCnt);
        if (fn) fn('queryService timeout');
    }, (tmo || 60)*1000); // 60s timeout in default
    
    self.once('querysrv'+self.querysrvCbCnt, function(srv){
        clearTimeout(t);

        if (srv.err) {
            if (fn) fn(srv.err+',query service failed');
        } else {
            if (fn) fn(null, srv);
        }
    });

    // 2.
    // fill offer message
    var opc_msg = {};
    opc_msg.opc = SEP.SEP_OPC_SRV_QUERY_OFFER;
    
    // 2.0
    // !!! place callback count in message context
    opc_msg.evcbcnt = self.querysrvCbCnt++;

    // 2.1
    // fill service info, check default parameters
    srv.domain = srv.domain || self.usrinfo.domain;
    srv.usrkey = srv.usrkey || self.usrinfo.usrkey;
    srv.timeAt = Date.now();
    ///srv.geosAt  = ; // TBD...
    opc_msg.offer = {
        srv: srv
    };
    if (Debug) console.log('query service:'+JSON.stringify(srv));
    
    // 3.
    // send opc 
    self.sendOpcMsg(opc_msg, function(err){
        if (err && fn) fn(err+',queryService failed'); 
    });
    
    return self;
};

// ACL entry update
// address MUST, port is optional
nmCln.prototype.allowAcl = function(address, port){
    var self = this;
    var local = isLocalhost(address);
    
    if (local || (address === self.ipaddr)) {
        if (Debug) console.log('always allow local network');
    } else {    
	    var family = UDT.isIP(address);
	    
	    if (family) {
		    if (port) {
		        self.acls['v'+family+':'+address+':'+port] = true;
		    } else {
		    	Object.keys(self.acls).forEach(function(k){
		            if (k.match('v'+family+':'+address)) {
		                self.acls[k] = true;
		            }
		        });
		        
		        self.acls['v'+family+':'+address] = true;
		    }
	    }
    }
    
    return self;
};

// address is MUST, port is optional
nmCln.prototype.denyAcl = function(address, port){
    var self = this;
    var local = isLocalhost(address);
    
    if (local || (address === self.ipaddr)) {
        if (Debug) console.log('always allow local network');
    } else {
	    var family = UDT.isIP(address);
	    
	    if (family) {
		    if (port) {
		        self.acls['v'+family+':'+address+':'+port] = false;
		    } else {
		    	Object.keys(self.acls).forEach(function(k){
		            if (k.match('v'+family+':'+address)) {
		                self.acls[k] = false;
		            }
		        });
		        
		        self.acls['v'+family+':'+address] = false;
		    }
	    }
    }
    
    return self;
};

// address, family, port is MUST
nmCln.prototype.checkAcl = function(address, port){
    var self = this;
    var local = isLocalhost(address);
    
    if (local || (address === self.ipaddr)) {
        if (Debug) console.log('always allow local network');
        return true;
    } else {
	    var family = UDT.isIP(address);
	    
	    return family &&
	          (self.acls['v'+family+':'+address] ||
	           self.acls['v'+family+':'+address+':'+port]);
    }
};

// Session state machine: created->login->(ready->reconnecting->ready)->logout
// TBD...decouple session with ws connection

// refresh SDP session
nmCln.prototype.login = function(options, fn){
    var self = this;
    
    // 1.
    // recreate this object in case pass options 
    if (typeof options === 'object') {
        self = new nmCln(options, fn);
    } else {
	    // 2.
	    // initialize state in case no options passed
	    self.reconnect = 0;
	    self.state = 'new';
    }
    
    // 3.
    // launch SDP session again
    self._LSM_setupSdpSession();
    
    return self;
};

nmCln.prototype.logout = function(fn){
    var self =  this;
    
    // 1.
    // set state to closing
    self.state = 'closing';
    
    try {
        // 2.
        // clear all existing connections
    
        // 2.1
        // close name-server connection
        for (var k in self.conn)
            if (self.conn[k] && self.conn[k].socket && self.conn[k].socket.close) {
                self.conn[k].socket.close();
            }
        
        // 2.2
        // close turn agent connection
        if (self.turnagentConn && self.turnagentConn.close) {
            self.turnagentConn.close();
        }
        
	    // 3.
	    // clear all existing servers
	    if (self.bsrv && self.bsrv.hpsrv && self.bsrv.hpsrv.close) {
	        self.bsrv.hpsrv.close();
	    }
	    if (self.bsrv && self.bsrv.srv && self.bsrv.srv.close) {
	        self.bsrv.srv.close();
	    }
    } catch (e) {
        console.log('clear all sockets, ignore '+e);
    }
    
    // 4.
    // emit closed event
    self.state = 'closed';
    self.emit('closed');
    
    if (fn) {
        fn(null);
    }
    
    return self;
};

// get vURL info
// do user authentication in server side
nmCln.prototype.getvURLInfo = function(vurl, fn, tmo){
    var self = this;
    
    // normalize vURL
    var vurlstr = vurl.match(vURL.regex_vboth);
    if (vurlstr && vurlstr[0]) {
        vurl = vurlstr[0];
    } else {
        if (fn) fn('invalid vURL');
        
        return self;
    }
    
    // vURL info cache
    self.vurlInfoCache = self.vurlInfoCache || {};
    
    if ((vurl in self.vurlInfoCache) && self.vurlInfoCache[vurl]) {
        fn(null, self.vurlInfoCache[vurl]);
        return self;
    }
    
    // callback event count
    self.vurlinfoCbCnt = self.vurlinfoCbCnt || 0;

    // 1.
    // added event listener with timeout
    var t = setTimeout(function(){
	    self.removeAllListeners('vurlinfo'+self.vurlinfoCbCnt);
        if (fn) fn('vurlinfo timeout');
    }, (tmo || 60)*1000); // 60s timeout in default
    
    self.once('vurlinfo'+self.vurlinfoCbCnt, function(info){
        clearTimeout(t);

        if (info.err) {
            if (fn) fn(info.err+',get vURL info failed');
        } else {
            // cache and send it back
            self.vurlInfoCache[vurl] = info;
            
            if (fn) fn(null, info);
            
            // clear cache after 10mins
            // TBD... optimized
            setTimeout(function(){
                self.vurlInfoCache[vurl] = null;    
            }, 600000);
        }
    });

    // 2.
    // fill offer message
    var opc_msg = {};
    opc_msg.opc = SEP.SEP_OPC_VURL_INFO_OFFER;
    
    // 2.0
    // !!! place callback count in message context
    opc_msg.evcbcnt = self.vurlinfoCbCnt++;

    // 2.1
    // fill self user info with vURL
    opc_msg.offer = {
        mine: self.usrinfo,
        vurl: vurl
    };
    
    // 3.
    // send opc 
    self.sendOpcMsg(opc_msg, function(err){
        if (err && fn) fn(err+',get vURL info failed'); 
    });
    
    return self;
};

// check if STUN session alable to destination by vURL
// support only async NAT/FW by now
// TBD ... one async, while other sync NAT/FW
nmCln.prototype.checkStunable = function(vurle, fn){
    var self = this;
    
    // normalize vURL
    var vurlstr = vurle.match(vURL.regex_vboth);
    if (vurlstr && vurlstr[0]) {
        vurle = vurlstr[0];
    } else {
        if (fn) fn('invalid vURL');
        
        return self;
    }
    
    // stun ablility check cache with clear timer
    self.checkStunCache = self.checkStunCache || {};
    
    if ((vurle in self.checkStunCache) && (typeof self.checkStunCache[vurle] !== 'undefined')) {
        fn(null, self.checkStunCache[vurle]);
        return self;
    }
    
  	// 1.
	// get peer info by vURL
    self.getvURLInfo(vurle, function(err, routing){
        // 1.1
        // check error and authentication 
        if (err || !routing) {            
            // invalidate stun alility cache
            if (self.checkStunCache[vurle]) 
                self.checkStunCache[vurle] = null;
                
            // invalid vURL
            console.log(err+',setup STUN to peer failed, invalid vURL');
            fn(err+',setup STUN to peer failed, invalid vURL');
        } else {
            // 2.
            // try to setup STUN session to peer
            self.getClntSdps(routing.dst.gid, function(err, sdps){
                if (!err) {
                    if (Debug) console.log('SDPs answer:'+JSON.stringify(sdps));
                    
                    var peer = {
					    gid: sdps[0].from.gid, 
					  vpath: sdps[0].from.vpath,
					  vhost: sdps[0].from.vhost,
					  vmode: sdps[0].from.vmode,
				     vtoken: sdps[0].from.vtoken,
					secmode: sdps[0].from.secmode,
					   
					    lip: sdps[0].from.localIP,
					  lport: sdps[0].from.localPort,
						     
					 natype: sdps[0].to.natype, 
							
					     ip: sdps[0].rel.clntIP, 
					   port: sdps[0].rel.clntPort
				    };
				    
				    // return asymmetric NAT/FW count
				    if (self.natype && peer.natype) {
				        self.checkStunCache[vurle] = 0;
				    } else if (self.natype || peer.natype) {
				    	///self.checkStunCache[vurle] = 1;
				    	// disable asym/sym traverse TBD...
				    	self.checkStunCache[vurle] = 0;
				    } else {
				        self.checkStunCache[vurle] = 2;
				    }
				    fn(null, self.checkStunCache[vurle]);
				} else {
                    console.log(err+',setup STUN to peer failed');
                    fn(err+',setup STUN to peer failed');
                }      
            });
        }
    });
    
    return self;
};

// traverse STUN session by vURL
nmCln.prototype.trvsSTUN = function(vurle, fn){
    var self = this;
    
    // normalize vURL
    var vurlstr = vurle.match(vURL.regex_vboth);
    if (vurlstr && vurlstr[0]) {
        vurle = vurlstr[0];
    } else {
        if (fn) fn('invalid vURL');
        
        return self;
    }
    
    // stun traverse cache with clear timer
    self.trvsStunCache = self.trvsStunCache || {};
    
    if ((vurle in self.trvsStunCache) && self.trvsStunCache[vurle]) {
        fn(null, self.trvsStunCache[vurle]);
        return self;
    }
    
	// 1.
	// get peer info by vURL
    self.getvURLInfo(vurle, function(err, routing){
        // 1.1
        // check error and authentication 
        if (err || !routing) {            
            // invalidate traverse cache
            if (self.trvsStunCache[vurle]) 
                self.trvsStunCache[vurle] = null;
                
            // invalid vURL
            console.log(err+',setup STUN to peer failed, invalid vURL');
            fn(err+',setup STUN to peer failed, invalid vURL');
            
            return;
        } else {
            // 2.
            // try to setup STUN session to peer
            self.getClntSdps(routing.dst.gid, function(err, sdps){
                if (!err) {
                    if (Debug) console.log('SDPs answer:'+JSON.stringify(sdps));
                    
                    var peerinfo = {
					    gid: sdps[0].from.gid, 
					  vpath: sdps[0].from.vpath,
					  vhost: sdps[0].from.vhost,
					  vmode: sdps[0].from.vmode,
				     vtoken: sdps[0].from.vtoken,
					secmode: sdps[0].from.secmode,
					   
					    lip: sdps[0].from.localIP,
					  lport: sdps[0].from.localPort,
						     
					 natype: sdps[0].to.natype, 
							
					     ip: sdps[0].rel.clntIP, 
					   port: sdps[0].rel.clntPort
				    };
				    
				    // create STUN session 
                    self.offerStun({endpoint: peerinfo}, function(err, stun){
                        if (err || !stun) {
                            console.log(err+',setup STUN to peer failed');
                            fn(err+',setup STUN to peer failed');
                        } else {
                            // check race condition
                            if (self.trvsStunCache[vurle]) {
                                console.log('setup STUN to peer oldone:'+JSON.stringify(peerinfo));
                                fn(null, self.trvsStunCache[vurle]);
                            } else {
                                console.log('setup STUN to peer newone:'+JSON.stringify(peerinfo));
                                
	                            // cache and send it back
	                            self.trvsStunCache[vurle] = stun;
	                            
	                            // count stun session
	                            self.trvsStunCache[vurle].stun_count = 1;
	                            
	                            stun.firstrun = true;
	                            fn(null, stun);
	                            stun.firstrun = false;

	                            if (self.keephole) {
	                            	if (Debug) 
	                            		console.log(vurle+': keep first hole');
	                            } else {
	                            	// clear cache after about 3mins(default UDP Router/NAT timeout is about 300s)
	                            	// TBD... optimized
	                            	setTimeout(function(){
	                            		self.trvsStunCache[vurle] = null;    
	                            	}, 568000); // force clean stun session after ~<10mins
	                            }
                            }
                        }
                    });     
                } else {
                    console.log(err+',setup STUN to peer failed');
                    fn(err+',setup STUN to peer failed');
                }
            });
        }
    });
    
    return self;
};

// traverse TURN session by vURL
nmCln.prototype.trvsTURN = function(vurle, fn){
    var self = this;
    
    // normalize vURL
    var vurlstr = vurle.match(vURL.regex_vboth);
    if (vurlstr && vurlstr[0]) {
        vurle = vurlstr[0];
    } else {
        if (fn) fn('invalid vURL');
        
        return self;
    }
    
    // turn traverse cache with clear timer
    self.trvsTurnCache = self.trvsTurnCache || {};
    
    if ((vurle in self.trvsTurnCache) && self.trvsTurnCache[vurle]) {
        fn(null, self.trvsTurnCache[vurle]);
        return self;
    }
    
	// 1.
	// get peer info by vURL
    self.getvURLInfo(vurle, function(err, routing){
        // 1.1
        // check error and authentication 
        if (err || !routing) {            
            // invalidate traverse cache
            if (self.trvsTurnCache[vurle]) 
                self.trvsTurnCache[vurle] = null;
                
            // invalid vURL
            console.log(err+',setup TURN to peer failed, invalid vURL');
            fn(err+',setup TURN to peer failed, invalid vURL');
            
            return;
        } else {
            // 2.
            // try to setup TURN session to peer
            self.getClntSdps(routing.dst.gid, function(err, sdps){
                if (!err) {
                    if (Debug) console.log('SDPs answer:'+JSON.stringify(sdps));
                    
                    var peerinfo = {
					    gid: sdps[0].from.gid, 
					  vpath: sdps[0].from.vpath,
					  vhost: sdps[0].from.vhost,
					  vmode: sdps[0].from.vmode,
				     vtoken: sdps[0].from.vtoken,
					secmode: sdps[0].from.secmode,
					   
					    lip: sdps[0].from.localIP,
					  lport: sdps[0].from.localPort,
						     
					 natype: sdps[0].to.natype, 
							
					     ip: sdps[0].rel.clntIP, 
					   port: sdps[0].rel.clntPort
				    };
				    
				    // create TURN session 
                    self.offerTurn({endpoint: peerinfo, sesn: SEP.SEP_SESN_TURN}, function(err, turn){                        
                        if (err || !turn) {
                            console.log(err+',setup TURN to peer failed');
                            fn(err+',setup TURN to peer failed');
                        } else {
                            // check race condition
                            if (self.trvsTurnCache[vurle]) {
                                console.log('setup TURN to peer oldone:'+JSON.stringify(peerinfo));
                                fn(null, self.trvsTurnCache[vurle]);
                            } else {
                                console.log('setup TURN to peer newone:'+JSON.stringify(peerinfo));
                                
	                            // cache and send it back
	                            self.trvsTurnCache[vurle] = turn;
	                            
	                            turn.firstrun = true;
	                            fn(null, turn);
	                            turn.firstrun = false;
                            }
                        }
                    });     
                } else {
                    console.log(err+',setup TURN to peer failed');
                    fn(err+',setup TURN to peer failed');
                }
            });
        }
    });
    
    return self;
};

// make http CONNECT tunnel over STUN or TURN by vURL
// TBD...
// notes: 
// - vurl is destination name-client's vURL
// - fn is like function(err, rres, rsocket, rhead)
nmCln.prototype.makeTunnel = function(vurl, fn){
    var self = this;

    return self;
};

// class methods

// exports SEP
exports.SEP = SEP;

// exports vURL
exports.vURL = vURL;

// exports Version
exports.Version = 2;

