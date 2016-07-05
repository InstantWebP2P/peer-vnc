// Nacl certification implementation
// Copyright (c) 2014 Tom Zhou<iwebpp@gmail.com>


(function(Export, Nacl, UUID){
	var CERT_VERSION = '1.0';
	
	// Generate cert
	// @param reqdesc: nacl cert description request to sign
	// @param   cakey: nacl ca signature secret key 
	// @param  cacert: ca cert, self-signed 
	// @return cert on success, false on fail
	Export.generate = function(reqdesc, cakey, cacert) {
		// check version
		if (!(reqdesc && reqdesc.version === CERT_VERSION)) {
			console.log('Invalid cert request version');
			return false;
		}

		// check time-to-expire
		if (reqdesc.tte && reqdesc.tte < new Date().getTime()) {
			console.log('Invalid cert time-to-expire, smaller than current time');
			return false;
		}
						
		// check type
		if (reqdesc && 
		    reqdesc.type && 
		   (reqdesc.type.toLowerCase() === 'self' || 
		    reqdesc.type.toLowerCase() === 'ca')) {
			// override CA field
			if (reqdesc.type === 'ca') {
				reqdesc.ca = cacert.desc.ca;

				// check time-to-expire
				if (reqdesc.tte && reqdesc.tte > cacert.desc.tte) {
					console.log('Invalid cert time-to-expire, bigger than CA');
					return false;
				}
			}
			
			// append fields
			reqdesc.signtime = new Date().getTime();
			reqdesc.gid = UUID.v4();

			var cert = {desc: reqdesc};

			// stringify cert.desc
			var descstr = JSON.stringify(cert.desc);
			///console.log('\ngenerate for '+descstr);
			var descbuf = isNodeJS() ? new Uint8Array(new Buffer(descstr, 'utf-8')) :
					                   Nacl.util.decodeUTF8(descstr);

			if (!((cakey &&				  
				   Array.isArray(cakey) &&
				   cakey.length === Nacl.sign.secretKeyLength) ||
				  (cakey &&				  
				   cakey instanceof Uint8Array &&
				   cakey.length === Nacl.sign.secretKeyLength))) {
				console.log('Invalid cert sign secretKey');
				return false;
			}
			var signSecretKey = (cakey instanceof Uint8Array) ? cakey : ArrayToUint8(cakey);

			// sign signature
			var signature = Nacl.sign.detached(descbuf, signSecretKey);
			if (!signature) {
				console.log('Sign signature failed');
				return false;
			}
			
			// append signature
			cert.sign = {};
			cert.sign.signature = Uint8ToArray(signature);
			
			return cert;
		} else  {
			console.log('Invalid cert type');
			return false;
		}
	}

	// Validate cert
	// @param reqdesc: nacl cert description to sign
	// @param  cacert: ca cert, ignore it in case self-sign 
	// @return true on success, false on fail
	Export.validate = function(cert, cacert) {
		// check time-to-expire
		if (!(cert && cert.desc && cert.desc.tte > new Date().getTime())) {
			console.log('nacl cert expired');
			return false;
		}

		// check version
		if (!(cert && cert.desc && cert.desc.version.toLowerCase() === CERT_VERSION)) {
			console.log('Invalid cert version');
			return false;
		}

		// check type
		if (cert && 
			cert.desc && 
			cert.desc.type && 
			cert.desc.type.toLowerCase() === 'self') {
            // extract nacl sign publicKey
			if (!(cert && 
				  cert.desc && 
				  cert.desc.publickey && 
				  Array.isArray(cert.desc.publickey) &&
				  cert.desc.publickey.length === Nacl.sign.publicKeyLength)) {
				console.log('Invalid cert sign publicKey');
				return false;
			}
			var signPublicKey = ArrayToUint8(cert.desc.publickey);
			
			// stringify cert.desc
			var descstr = JSON.stringify(cert.desc);
			///console.log('\nvalidate for self-signed:'+descstr);
			var descbuf = isNodeJS() ? new Uint8Array(new Buffer(descstr, 'utf-8')) :
					                   Nacl.util.decodeUTF8(descstr);
			
			// extract signature
			if (!(cert && 
				  cert.sign && 
				  cert.sign.signature && 
				  Array.isArray(cert.sign.signature) &&
				  cert.sign.signature.length === Nacl.sign.signatureLength)) {
				console.log('Invalid signature');
				return false;
			}
			var signature = ArrayToUint8(cert.sign.signature);
			
			// verify signature
			if (!Nacl.sign.detached.verify(descbuf, signature, signPublicKey)) {
				console.log('Verify signature failed');
				return false;
			}
		} else if (cert && 
				   cert.desc && 
				   cert.desc.type && 
				   cert.desc.type.toLowerCase() === 'ca') {
            // check CA cert, MUST be self-signed
			if (!(cacert &&
				  cacert.desc &&
				  cacert.desc.type &&
				  cacert.desc.type.toLowerCase() === 'self')) {
				console.log('CA cert MUST be self-signed');
				return false;
			}
			if (!Export.validate(cacert)) {
				console.log('Invalid CA cert');
				return false;
			}
			
			// check CA name
			if (!(cert.desc.ca && 
				  cacert.desc.ca && 
				 (cert.desc.ca.toLowerCase() === cacert.desc.ca.toLowerCase()))) {
				console.log('CA not matched');
				return false;
			}
			
			// check CA time-to-expire
			if (cert.desc.tte && cert.desc.tte > cacert.desc.tte) {
				console.log('Invalid cert time-to-expire, bigger than CA');
				return false;
			}
			
			// extract nacl sign publicKey
			var casignPublicKey = ArrayToUint8(cacert.desc.publickey);

			// stringify cert.desc
			var cadescstr = JSON.stringify(cert.desc);
			///console.log('\nvalidate for ca-sign:'+cadescstr);
			var cadescbuf = isNodeJS() ? new Uint8Array(new Buffer(cadescstr, 'utf-8')) :
					                     Nacl.util.decodeUTF8(cadescstr);
			
			// extract signature
			if (!(cert && 
				  cert.sign && 
				  cert.sign.signature && 
				  Array.isArray(cert.sign.signature) &&
				  cert.sign.signature.length === Nacl.sign.signatureLength)) {
				console.log('Invalid signature');
				return false;
			}
			var casignature = ArrayToUint8(cert.sign.signature);

			// verify signature
			if (!Nacl.sign.detached.verify(cadescbuf, casignature, casignPublicKey)) {
				console.log('Verify signature failed');
				return false;
			}
		} else  {
			console.log('Invalid cert type');
			return false;
		}

		return true;
	}

	// Check domain name
	Export.checkDomain = function(cert, expectDomain) {
		///console.log('expectDomain:'+expectDomain);
		var ret = false;

		if (cert.desc && cert.desc.names)
			for (var i = 0; i < cert.desc.names.length; i ++)
				// allow sub-domain match, like xxx.iwebpp.com will pass in case cert name is iwebpp.com
				if (expectDomain) {
					var nmreg = new RegExp('(('+cert.desc.names[i]+')|(.'+cert.desc.names[i]+')$)',"gi");
					if (expectDomain.match(nmreg)) {
						///console.log('checkDomain passed');
						ret = true;
						break;
					}
				}

		return ret;
	}

	// Check ip
	Export.checkIP = function(cert, expectIP) {
		///console.log('expectIP:'+expectIP);
		var ret = false;

		if (cert.desc && cert.desc.ips)
			for (var i = 0; i < cert.desc.ips.length; i ++)
				if (expectIP && expectIP === cert.desc.ips[i]) {
					ret = true;
					break;
				}

		return ret;
	}

	// Generate self-sgin CA
	// @param cainfo: fill domain name, time-to-expire
	Export.generateCA = function(cainfo) {
		// prepare self-sign reqdesc
		var reqdesc = {};
		reqdesc.version = '1.0';       // fixed
		reqdesc.type    = 'self';      // fixed
		reqdesc.ca      = cainfo.name; // user input
		reqdesc.tte     = cainfo.tte;  // user input

		// generate Sign keypair
		var skp           = Nacl.sign.keyPair();
		reqdesc.publickey = Uint8ToArray(skp.publicKey);

		// generate cert
		var cert = Export.generate(reqdesc, skp.secretKey);

		// return cert with Sign secretKey as JSON array
		return {cert: cert, secretkey: Uint8ToArray(skp.secretKey)};
	}
	
	// default NACL rootCA cert, never modify it
	Export.rootCACert = JSON.parse('{"desc":{"version":"1.0","type":"self","ca":"iwebpp.com","tte":4570381246341,"publickey":[237,135,86,100,145,128,37,184,250,64,66,132,116,123,207,51,182,199,59,95,17,186,93,249,220,212,109,77,200,222,157,67],"signtime":1416781246454,"gid":"d2f971fc-98ad-4dea-ada2-74ebc129ed99"},"sign":{"signature":[214,154,215,247,146,167,144,7,25,170,129,182,224,231,13,239,250,159,139,23,184,249,151,12,153,188,61,76,32,215,218,31,185,251,224,222,15,3,17,53,121,125,166,143,167,52,148,146,85,94,234,202,196,157,211,142,134,74,109,78,7,123,177,2]}}');

	// default NACL testCA, including cert and secretkey
	Export.testCA = JSON.parse('{"cert":{"desc":{"version":"1.0","type":"self","ca":"iwebpp.com","tte":1732375104475,"publickey":[16,239,203,168,67,4,190,200,68,163,63,140,27,142,10,25,65,227,92,199,166,33,30,92,73,221,145,174,220,55,82,34],"signtime":1417015104534,"gid":"8d0fdd95-566c-4917-b158-36bace3254c7"},"sign":{"signature":[84,224,227,61,149,247,74,147,167,225,148,123,103,7,168,101,136,193,121,64,93,37,82,154,3,116,119,206,5,56,96,74,87,195,58,110,233,117,52,57,237,80,91,39,25,223,50,114,201,72,159,158,75,0,230,13,33,34,134,167,171,129,52,0]}},"secretkey":[146,248,181,166,252,192,146,133,46,43,69,244,31,182,120,173,115,43,14,89,157,78,77,216,13,240,28,84,186,40,174,232,16,239,203,168,67,4,190,200,68,163,63,140,27,142,10,25,65,227,92,199,166,33,30,92,73,221,145,174,220,55,82,34]}');
	
	// NACL Box keypair
	Export.BoxkeyPair = Nacl.box.keyPair;
	
	// NACL Signature keypair
	Export.SignkeyPair = Nacl.sign.keyPair;
	
	// Utils
	function ArrayToUint8(data) {
		if (Array.isArray(data)) {
			var ret = new Uint8Array(data.length);
			ret.set(data);
			return ret;
		} else if (data instanceof Uint8Array) {
			return data
		} else {
			console.log('invalid ArrayToUint8:'+JSON.stringify(data));
			return null;
		}
	}
	function Uint8ToArray(data) {
		if (Array.isArray(data)) {
			return data;
		} else if (data instanceof Uint8Array) {
			return Array.prototype.slice.call(data);
		} else {
			console.log('invalid Uint8ToArray:'+JSON.stringify(data));
			return null;
		}
	}
	function isNodeJS() {
		return (typeof module != 'undefined' && typeof window === 'undefined');
	}
	
	Export.ArrayToUint8  = ArrayToUint8;
	Export.Uint8ToArray  = Uint8ToArray;
})(typeof module  !== 'undefined' ? module.exports                    :(window.naclcert = window.naclcert || {}), 
   typeof require !== 'undefined' ? require('tweetnacl/nacl-fast.js') : window.nacl,
   typeof require !== 'undefined' ? require('node-uuid')              : window.uuid);
		   