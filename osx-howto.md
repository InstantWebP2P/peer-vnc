1. Install tightVNC on OSx: http://tightvnc.com/download.php

2. Start tightVNC on a port like 5901, and set VNC admin/view password, allow access from loopback

3. Start peer-vnc: ./bin/osx/node ./bin/peer-vnc -t localhost:5901 -k anywords will show a URL

4. Open URL showed in step 3

