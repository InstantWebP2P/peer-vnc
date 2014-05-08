// Copyright (c) 2012 Tom Zhou<iwebpp@gmail.com>

var SEP = require('../lib/sep');

process.on('uncaughtException', function (err) {
  console.log('Caught exception: ' + err);
});

// p2p stream websocket library
var WebSocket = require('wspp');

// connecting to primary name-server
var con = new WebSocket('wss://iwebpp.com:51686'+SEP.SEP_CTRLPATH_NS, {httpp: true});

var t = setTimeout(function(){
    console.log('connecting to primary name-server timeout');
}, 2000); // 2s in default

con.on('open', function(){
    clearTimeout(t);
    console.log('connecting to primary name-server successfully');
    con.close();
});

// connecting to alternative name-server
var con1 = new WebSocket('wss://iwebpp.com:51868'+SEP.SEP_CTRLPATH_NS, {httpp: true});

var t1 = setTimeout(function(){
    console.log('connecting to alternative name-server timeout');
}, 2000); // 2s in default

con1.on('open', function(){
    clearTimeout(t1);
    console.log('connecting to alternative name-server successfully');
    con1.close();
});
