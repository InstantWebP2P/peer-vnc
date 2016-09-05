'use strict';

/*!
 * ws: a node.js websocket client
 * Copyright(c) 2011 Einar Otto Stangvik <einaros@gmail.com>
 * MIT Licensed
 */
var os = require('os');

try {
  module.exports = require('bufferutil');
} catch (e) {
  module.exports = require('./BufferUtil.fallback');
}
