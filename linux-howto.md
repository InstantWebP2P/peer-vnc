1. Install tightVNC server: sudo apt-get install tightvncserver

2. Set VNC password: tightvncpasswd

3. Start VNC server: tightvncserver

4. Notes: start VNC server for the first time, it listens on 5901, for second time, listen on 5902 ... 

5. Start PeerVNC service:

for Linux X86_64: ./bin/linux64/node ./bin/peer-vnc -t localhost:5901 -k anywords will show a URL

for Linux X86: ./bin/linux32/node ./bin/peer-vnc -t localhost:5901 -k anywords will show a URL

6. Open URL showed in step 5

