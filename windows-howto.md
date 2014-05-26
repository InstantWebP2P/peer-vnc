1. Install VNC server like tightVNC on Windows32/Windows64: http://tightvnc.com/download.php

2. Start VNC server, and set VNC admin/view password

3. Set VNC server allow access from loopback (and only allow access from loopback)

4. Start peer-vnc: .\bin\node.exe .\bin\peer-vnc -t localhost:5900 -k anywords will show a URL

5. Open URL showed in step 3

