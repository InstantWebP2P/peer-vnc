// Copyright (c) 2012 Tom Zhou<iwebpp@gmail.com>

var SEP = require('../lib/sep');
var nmCln = require('../lib/iwebpp.io');

// iwebpp-ws library
var WebSocket = require('wspp');
var WebSocketServer = WebSocket.Server;

// msgpack library
var msgpack = require('msgpack-js');

// vURL
var vURL = require('../lib/vurl');

// create websocket server with name-client
var creatNmclnWss = function(self) {
    var wss;
    
    wss = new WebSocketServer({httpp: true, server: self.bsrv.srv, path: SEP.SEP_CTRLPATH_BS});
	wss.on('connection', function(client){	
	    console.log('new ws connection: ' +
	                client._socket.remoteAddress+':'+client._socket.remotePort+' -> ' + 
	                client._socket.address().address+':'+client._socket.address().port);
								
	    client.on('message', function(message, flags) {
	        // flags.binary will be set if a binary message is received
	        // flags.masked will be set if the message was masked
	        var data = (flags.binary) ? msgpack.decode(message) : JSON.parse(message);
	        ///console.log('business message:'+JSON.stringify(data));
	        data += 'reply by C';
	
	        try {
	            client.send(msgpack.encode(data), {binary: true, mask: true}, function(err){
	                if (err) {
	                    console.log(err+',sendOpcMsg failed');
	                }
	            });
	        } catch (e) {
	            console.log(e+',sendOpcMsg failed immediately');
	        }
	    });
	});
}

// client C
var nmclnsC = new nmCln({
    srvinfo: {
        timeout: 20,
        endpoints: [{ip: 'iwebpp.com', port: 51686}, {ip: 'iwebpp.com', port: 51868}],
        turn: [
            {ip: 'iwebpp.com', agent: 51866, proxy: 51688} // every turn-server include proxy and agent port
        ]
    },
    usrinfo: {domain: '51dese.com', usrkey: 'C'},
    conmode: SEP.SEP_MODE_CS,
      vmode: vURL.URL_MODE_HOST
});

nmclnsC.on('ready', function(){
    console.log('name-nmclnsC ready');
    
    // create websocket server
    creatNmclnWss(this);
    
    // ask for all user info
    nmclnsC.getAllUsrs(function(err, usrs){
        if (!err) {
            ///console.log('got User info answer:'+usrs.length+','+JSON.stringify(usrs));
        } else {
            console.log(err);    
        }
    });

    // ask for all Logins info
    /*nmclnsC.getCllLogins(function(err, logins){
        if (!err) {
            console.log('got Logins answer:'+JSON.stringify(logins));
        } else {
            console.log(err);    
        }
    });
    */

    // ask for user-specific Logins info
    nmclnsC.getUsrLogins({domain: '51dese.com', usrkey: 'B'}, function(err, logins){
        if (!err) {
            ///console.log('nmclnsB Logins answer:'+logins.length+','+JSON.stringify(logins));
          
            // ask for client-specific Logins info
           nmclnsC.getClntSdps(logins[logins.length-1].to.gid, function(err, sdps){
                if (!err) {
                    ///console.log('nmclnsC SDPs answer:'+JSON.stringify(sdps));
                      						 
                    // try to setup STUN connection to peer
                    var peerinfo = {
					    gid: sdps[sdps.length-1].from.gid,
					  vpath: sdps[sdps.length-1].from.vpath,
					  vhost: sdps[sdps.length-1].from.vhost,
					  vmode: sdps[sdps.length-1].from.vmode,
					 vtoken: sdps[sdps.length-1].from.vtoken,
				    secmode: sdps[sdps.length-1].from.secmode,
					   
					    lip: sdps[sdps.length-1].from.localIP,
					  lport: sdps[sdps.length-1].from.localPort,
						     
					 natype: sdps[sdps.length-1].to.natype, 
							
					     ip: sdps[sdps.length-1].rel.clntIP, 
					   port: sdps[sdps.length-1].rel.clntPort
				    };
				    
                   nmclnsC.offerStun({endpoint: peerinfo}, function(err, stun){
                        console.log('C setup stun to peer:'+JSON.stringify(peerinfo));
                        
                        if (err || !stun) return console.log(err+',setup STUN to peer failed');
                        
						// try to connect to peer													
                       nmclnsC.createConnection({endpoint: peerinfo}, function(err, socket){
                            console.log('C connected to peer:'+JSON.stringify(peerinfo));
                            
                            if (err || !socket) return console.log(err+',connect to peer failed');
                            
                            socket.on('message', function(message, flags) {
					            // flags.binary will be set if a binary message is received
                                // flags.masked will be set if the message was masked
                                var data = (flags.binary) ? msgpack.decode(message) : JSON.parse(message);
                                console.log(JSON.stringify(data));
							});
							
							setInterval(function(){
							    socket.send(msgpack.encode('Hello, This is C :)'), {binary: true, mask: true});
							}, 2000);
                        });
                    });
                    
                    // create TURN session
                    nmclnsC.offerTurn({endpoint: peerinfo, sesn: SEP.SEP_SESN_TURN}, function(err, turn){
                        console.log('C setup turn to peer:'+JSON.stringify(peerinfo));
                        console.log('TURN:'+JSON.stringify(turn));
                        
                        if (err || !turn) return console.log(err+',setup TURN to peer failed');
                        
						// try to connect to peer
						var turninfo = {
					       vpath: turn.vpath,
					       vhost: turn.vhost,
					       vmode: turn.vmode,
					      vtoken: turn.vtoken,
					     secmode: turn.secmode,
					     
					         lip: turn.srvIP,
					       lport: turn.proxyPort,
							
					          ip: turn.srvIP, 
					        port: turn.proxyPort						
						};													
                        nmclnsC.createConnection({endpoint: turninfo, sesn: SEP.SEP_SESN_TURN}, function(err, socket){
                            console.log('C connected to peer via TURN:'+JSON.stringify(turninfo));
                            
                            if (err || !socket) return console.log(err+',connect to turn failed');
                            
                            socket.on('message', function(message, flags) {
					            // flags.binary will be set if a binary message is received
                                // flags.masked will be set if the message was masked
                                var data = (flags.binary) ? msgpack.decode(message) : JSON.parse(message);
                                console.log(JSON.stringify(data));
							});
							
							setInterval(function(){
							    socket.send(msgpack.encode('Hello, This is C on TURN. :)'), {binary: true, mask: true});
							}, 2000);
                        });
                    });                    
                } else {
                    console.log(err);    
                }
            });
        } else {
            console.log(err);    
        }
    });
    
    // fake web service
    nmclnsC.bsrv.srv.on('request', function(req, res){
        res.end('hello, this is C');
    });
    
});
