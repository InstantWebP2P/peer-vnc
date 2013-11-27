#!/usr/bin/env node
var msgpack = require('./msgpack');
var util = require('util');
var assert = require('assert');

var tests = [
  true, false, null, undefined,
  0, 1, -1, 2, -2, 4, -4, 6, -6,
  0x10, -0x10, 0x20, -0x20, 0x40, -0x40,
  0x80, -0x80, 0x100, -0x100, 0x200, -0x100,
  0x1000, -0x1000, 0x10000, -0x10000,
  0x20000, -0x20000, 0x40000,-0x40000,
  10, 100, 1000, 10000, 100000, 1000000,
  -10, -100, -1000, -10000, -100000, -1000000,
  'hello', 'world', Buffer("Hello"), Buffer("World"),
  [1,2,3], [], {name: "Tim", age: 29}, {},
  {a: 1, b: 2, c: [1, 2, 3]},
];
for (var i = 0, l = tests.length; i < l; i++) {
  var test = tests[i];
  if (typeof test === 'number') {
    tests.push(test + 1);
    tests.push(test - 1);
    tests.push(test + 0.5);
  }
}
[0x100, 0x1000, 0x10000, 0x100000].forEach(function (length) {
  var list = new Array(length), obj = {};
  for (var i = 0; i < length; i++) {
    list[i] = i;
    obj[i] = i;
  }
  tests.push(list);
  tests.push(obj);
});

var width = 80;
if (process.stdout.isTTY) {
  width = process.stdout.getWindowSize()[0];
}
var mistakes = 0;
function dump(value) {
  if (typeof value === 'undefined' || Buffer.isBuffer(value)) {
    return util.inspect(value).replace(/\n */g, '');
  }
  return JSON.stringify(value);
}
tests.forEach(function (test) {
  console.log(dump(test).substr(0, width));
  var encoded = msgpack.encode(test);
  console.log(encoded.inspect().substr(0, width));
  var decoded = msgpack.decode(encoded);
  try {
    assert.deepEqual(test, decoded);
    if (typeof test === "object" && test !== null) {
      assert.equal(test.constructor, decoded.constructor);
    }
  } catch (err) {
    console.error();
    console.error(dump(test).substr(0, width));
    console.error(encoded.inspect().substr(0, width));
    console.error(dump(decoded).substr(0, width));
    console.error(err.stack);
    mistakes++;
  }
});
if (mistakes) {
  console.error(mistakes + " tests failed!");
} else {
  console.log("\nAll tests passed successfully!");
}
process.exit(mistakes.length);
