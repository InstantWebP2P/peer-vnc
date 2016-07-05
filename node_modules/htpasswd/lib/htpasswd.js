#!/usr/bin/env node

/**
 * Now use CoffeeScript.
 */
require('coffee-script/register');

var program, processor, utils;

if (require.main === module ) {
	// Parses and processes command line arguments.
	program = require('./program');
	processor = require('./processor');
	program.parse(process.argv);
	processor.process(program);
} else { // Library mode.
	utils = require('./utils');
    module.exports.verify = utils.verify;
}