#!/bin/sh
rm -rf ./certs/*.pem
openssl req  -x509 -nodes -days 1868 -subj "/C=CN/ST=SH/L=SH/CN=$1" -newkey rsa:2048 -keyout ./certs/server-key.pem -out ./certs/server-cert.pem
