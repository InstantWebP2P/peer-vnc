peer-vnc
==========

Access VNC from anywhere using web browser even behind NAT/FW based on noVNC

### Features

* Support all HTML5-enabled web browsers
* Access VNC desktop from anywhere
* Expose VNC desktop behind NAT/FW
* Proxy to multiple VNC server in single [appnet.link](https://github.com/InstantWebP2P/appnet.link) client
* Provide end-to-end security
* Run over STUN session with papp-pac
* Support http basic-auth
* Support upload file to remote server by drag and drop
* Support VNC fullscreen mode
* Support UTF-8 clipboard in combined with [zvnc](https://github.com/5GApp/zvnc) Xvnc server

### Install manually

* peer-vnc depend on node-httpp, please build it from repo [nodejs-httpp](https://github.com/InstantWebP2P/nodejs-httpp)
* npm install peer-vnc, or git clone [peer-vnc](https://github.com/InstantWebP2P/peer-vnc.git) && cd peer-vnc && npm install
* setup your own AppNet.link backend controller services refer to [AppNet.link-controller](https://github.com/InstantWebP2P/appnet.link-controller)

### Usage/API:

    1. create vnc-example.js
    var Proxy = require('peer-vnc');
    
    new Proxy('192.168.1.1:5900', function(err, proxyURL){
        console.log('VNC                   Proxy URL(please open it on browser)');
        for (var k in proxyURL) {
            console.log(k+'        '+proxyURL[k]);
        }
    });
    
    2. launch proxy server by node-httpp-binary-directory/node.exe vnc-example.js in case Windows machine.
       console dump like below:
       VNC                   Proxy URL(please open it on browser)
       192.168.1.1:5900        https://af5e83731df02546.vurl.51dese.com:51688/vtoken/bb39fb0eb29f081e/peervnc
       
    3. use peer-vnc binary on Linux, like  ./bin/peer-vnc -t 192.168.1.1:5900 -s acl -a srv -b user:pass -d /auto/vshare/
       VNC                   Proxy URL(please open it on browser)
       192.168.1.1:5900        https://41c522dab4ae47f9.vurl.51dese.com:51688/vtoken/516c97b3070de2e1/peervnc

    4. run over STUN with appnet.io-stun-proxy, just embed 'vlocal.' as sub-domain in origin vURL, 
       like https://41c522dab4ae47f9.vurl.vlocal.51dese.com:51688/vtoken/516c97b3070de2e1/peervnc
       
    5. use peer-vnc-direct binary without P2P, like  ./bin/peer-vnc-direct -t 192.168.1.1:5900 -s acl -a srv -b user:pass -d /auto/vshare/
       VNC                   Proxy URL(please open it on browser)
       192.168.1.1:5900        https://41c522dab4ae47f9.vurl.51dese.com:51688/192.168.1.1-5900 

### Support us

* Welcome contributing on document, codes, tests and issues


### License

(The MIT License)

Copyright (c) 2012-present Tom Zhou(appnet.link@gmail.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
