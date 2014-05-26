1. Install tightVNC on Pi: sudo apt-get install  tightvncserver 

2. Start tightVNC server and set VNC admin/view password:  tightvncserver && tightvncpasswd

3. Start peer-vnc: ./bin/rpi/node ./bin/peer-vnc -t localhost:5901 -k anywords will show a URL

4. Open URL showed in step 3

