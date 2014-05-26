1. Install VNC server like realVNC on OSx

2. Start VNC server on a port like 5901, and set VNC admin/view password

3. Set VNC server allow access from loopback

4. Start peer-vnc: ./bin/osx/node ./bin/peer-vnc -t localhost:5901 -k anywords will show a URL

5. Open URL showed in step 3

