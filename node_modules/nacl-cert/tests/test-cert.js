var nacl = require('tweetnacl/nacl-fast');
var cert = require('../nacl-cert');

// self-sign
var ca = cert.generateCA({name: 'iwebpp.com', tte: new Date('2020-01-01').getTime()});
var ca2 = cert.generateCA({name: 'iwebpp.com', tte: new Date('2020-01-01').getTime()});

if (ca)
	console.log('\n\nself-signed CA:'+JSON.stringify(ca));
else 
	console.log('\n\nself-signed CA failed');

// validate CA
if (!cert.validate(ca.cert))
	throw new Error('\nself-signed CA validate wrong');
else
	console.log('\n\tself-signed CA validate ... pass');

// ca-sign

// generate Box keypair
var bkp = nacl.box.keyPair();

// prepare reqdesc
var reqdesc = {
    version: '1.0',
    type: 'ca',
    tte: new Date('2016-01-01').getTime(),
    publickey: cert.Uint8ToArray(bkp.publicKey),
    names: ['51dese.com','ruyier.com'],
    ips: ['127.0.0.1']
};

var bcert = cert.generate(reqdesc, ca.secretkey, ca.cert);

if (bcert)
	console.log('\n\nCA-signed cert:'+JSON.stringify(bcert));
else
	console.log('\n\nCA-signed cert failed');

// validate cert
if (!cert.validate(bcert, ca.cert))
	throw new Error('\nCA-signed Cert validate wrong');
else 
	console.log('\n\tCA-signed cert validate ... pass');

// check fake validate
if (cert.validate(bcert, ca2.cert))
	throw new Error('\nCA-signed Cert validate faked');
else 
	console.log('\n\tCA-signed cert validate ... pass');

