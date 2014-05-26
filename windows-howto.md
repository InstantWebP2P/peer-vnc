1. Install tightVNC on Windows32/Windows64: http://tightvnc.com/download.php

2. Start tightVNC, and set VNC admin/view password, allow access from loopback (and only allow access from loopback)

3. Start peer-vnc: .\bin\node.exe .\bin\peer-vnc -t localhost:5900 -k anywords will show a URL

4. Open URL showed in step 3

