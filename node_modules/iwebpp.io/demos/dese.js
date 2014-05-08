// Copyright (c) 2012 Tom Zhou<iwebpp@gmail.com>

var WEBPP = require('../lib/iwebpp.io'),
    SEP = WEBPP.SEP;

var express = require('express');

// vURL
var vURL = require('../lib/vurl');

// create name-client
var nmcln = new WEBPP({
    srvinfo: {
        timeout: 20,
        endpoints: [{ip: 'iwebpp.com', port: 51686}, {ip: 'iwebpp.com', port: 51868}],
        turn: [
            {ip: 'iwebpp.com', agent: 51866, proxy: 51688} // every turn-server include proxy and agent port
        ]
    },
    usrinfo: {domain: '51dese.com', usrkey: 'dese'},
    conmode: SEP.SEP_MODE_CS, // c/s mode as httpp server
      vmode: vURL.URL_MODE_HOST
});

nmcln.on('ready', function(){

/////////////////////////////////////////////////////////////////
// file share App
    var app = express();

    app.use(express.directory(__dirname + '/dese'));
    app.use(express.static(__dirname + '/dese'));
    app.use(function(req, res){
        res.end('invalid path');
    });
/////////////////////////////////////////////////////////////////
    
    // hook app on business server
    nmcln.bsrv.srv.on('request', app);
    
    // monitor network performance
    nmcln.bsrv.srv.on('connection', function(socket){
    
        var intl = setInterval(function(){
            ///console.log('socket network performance:'+JSON.stringify(socket.netPerf));
            if (socket) {
	            var perf = socket.netPerf;
	                     
	            console.log('socket network Bandwidth       :'+JSON.stringify(perf.mbpsBandwidth)+' Mb/s');
	            console.log('socket network RTT             :'+JSON.stringify(perf.msRTT)+' ms');
	            console.log('socket network PktSndPeriod    :'+JSON.stringify(perf.usPktSndPeriod)+' us');
	            console.log('socket network SendRate        :'+JSON.stringify(perf.mbpsSendRate)+' Mb/s');
	            console.log('socket network RecvRate        :'+JSON.stringify(perf.mbpsRecvRate)+' Mb/s');
	            console.log('socket network CongestionWindow:'+JSON.stringify(perf.pktCongestionWindow));
	            console.log('socket network RecvACK         :'+JSON.stringify(perf.pktRecvACK));
	            console.log('socket network RecvNACK        :'+JSON.stringify(perf.pktRecvNAK));
	            console.log('socket network AvailRcvBuf     :'+JSON.stringify(perf.byteAvailRcvBuf));
	            console.log('socket network AvailSndBuf     :'+JSON.stringify(perf.byteAvailSndBuf)+'\n\n');
            }
        }, 10000); // every 10000
        
        socket.on('close', function(){            
            clearInterval(intl);
            console.log('socket closed');
        });
        socket.on('error', function(){            
            clearInterval(intl);
            console.log('socket error');
        });
        socket.on('end', function(){            
            clearInterval(intl);
            console.log('socket end');
        });
    });
        
    console.log('please access URL:'+nmcln.vurl);
});
