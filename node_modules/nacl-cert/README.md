nacl-cert
---------

NACL Certification System


### Certification file format as JSON consists of description and signature two parts

* Description object defined as below
  {  
      // common part or request part  
        "version": string,       // version: '1.0'  
           "type": string,       // type: 'self', 'ca'  
            "tte": Date as ms,   // cert live time to expire from UTC 1970-01-01T00:00:00Z, ms  
             "ca": string        // CA domain name, like iwebpp.com,  
                                 // in case self-sign it MUST be filled in advance  
      "publickey": byte array,   // NACL Box public key to sign with CA,  
                                 // or Sign public key to sign by self  
          "names": string array, // domain name to ask sign, ignore for ca-sign cert  
            "ips": string array, // domain ip to ask sign, ignore for ca-sign cert  
      // append fields when sign  
            "gid": byte string,  // cert global id: 16 bytes of string  
       "signtime": Date as ms,   // signed time as ms from UTC 1970-01-01T00:00:00Z  
  }  
* Signature object defined as below
  {  
      signature: byte array      // NACL signature  
  }  
* Entire cert object defined as below
  {  
      desc: Description object,  
      sign: Signature object  
  }  

### Cert request object defined as Common part of Description

self-signed:  {  
     // common part or request part  
        "version": string,       // version: '1.0'  
           "type": 'self',       // type: 'self'  
            "tte": Date as ms,   // cert live time to expire from UTC 1970-01-01T00:00:00Z, ms  
             "ca": string        // CA domain name, like iwebpp.com  
      "publickey": byte array,   // NACL Sign public key to sign by self  
  }  
  
ca-signed:  {  
     // common part or request part  
        "version": string,       // version: '1.0'  
           "type": 'ca',         // type: 'ca'  
            "tte": Date as ms,   // cert live time to expire from UTC 1970-01-01T00:00:00Z, ms  
             "ca": string        // CA domain name, like iwebpp.com  
      "publickey": byte array,   // NACL box public key to sign  
          "names": string array, // domain name to ask sign  
            "ips": string array, // domain ip to ask sign  
  }  

<br/>
### License
(The MIT License)

Copyright (c) 2014 Tom Zhou(iwebpp@gmail.com)


