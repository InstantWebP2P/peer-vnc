#peer-vnc
==========

Web VNC client integrating noVNC with Node.js and iWebPP.io

### Features

* Support all HTML5-enabled web browsers
* Access VNC desktop from everywhere
* Expose VNC desktop behind NAT/FW
* Proxy to multiple VNC server in single iwebpp.io client
* Provide end-to-end security
* Run over STUN session with iwebpp.io-stun-proxy

### Install
* npm install peer-vnc, or git clone https://github.com/InstantWebP2P/peer-vnc.git && cd peer-vnc && npm install
* peer-vnc depend on node-httpp, please npm install httpp-binary.if the binay didn't work, just build it from source:
  https://github.com/InstantWebP2P/node-httpp

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
       192.168.1.1:5900        https://af5e83731df02546.vurl.iwebpp.com:51688/vtoken/bb39fb0eb29f081e/peervnc
       
    3. use peer-vnc binary on Linux, like  ./bin/peer-vnc -t 192.168.1.1:5900
       VNC                   Proxy URL(please open it on browser)
       192.168.1.1:5900        https://41c522dab4ae47f9.vurl.iwebpp.com:51688/vtoken/516c97b3070de2e1/peervnc

    4. run over STUN with iwebpp.io-stun-proxy, just embed 'vlocal.' as sub-domain in origin vURL, 
       like https://41c522dab4ae47f9.vurl.vlocal.iwebpp.com:51688/vtoken/516c97b3070de2e1/peervnc

<br/>
### License

(The MIT License)

Copyright (c) 2012-2013 Tom Zhou(iwebpp@gmail.com)

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
