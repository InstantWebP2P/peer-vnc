// iWebPP vURL pure JS implementation
// Copyright (c) 2012 Tom Zhou<iwebpp@gmail.com>
//
// Notes: vURL has two mode: vHost-based and vPath-based,
// in default, all service run vHost-based vURL.

// Version 1.0
exports.version = exports.VERSION = '1.0';

// vURL mode, vhost:0, vpath:1
exports.url_mode_host = exports.URL_MODE_HOST = 0;
exports.url_mode_path = exports.URL_MODE_PATH = 1;

// vURL related regex
exports.regex_url  = new RegExp('(https?)://[a-z0-9-]+(\.[a-z0-9-]+)+(/?)', 'gi');
exports.regex_href = new RegExp('href="(/?)[a-z0-9-/\.]+(/?)"', 'gi');

// vURL like *-*.vurl., /vurl/*-*
exports.regex_vurle = /([0-9]|[a-f]){32}/gi;

// vHost
exports.regex_vhost = /(([0-9]|[a-f]){32}-)*([0-9]|[a-f]){32}\.vurl\./gi;

// vPath
exports.regex_vpath = /\/vurl\/([0-9]|[a-f]){32}(-([0-9]|[a-f]){32})*/gi;

// both vHost and vPath
exports.regex_vboth = /((([0-9]|[a-f]){32}-)*([0-9]|[a-f]){32}\.vurl\.)|(\/vurl\/([0-9]|[a-f]){32}(-([0-9]|[a-f]){32})*)/;

// vToken
exports.regex_vtoken = /\/vtoken\/([0-9]|[a-f]){16}/gi;

