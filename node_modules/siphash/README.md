siphash.js
==========

A pure Javascript implementation of
[SipHash-2-4](http://131002.net/siphash/siphash.pdf)

> SipHash is a family of pseudorandom functions optimized for short
> inputs. Target applications include network traffic authentication and
> hash-table lookups protected against hash-flooding denial-of-service
> attacks. SipHash has well-defined security goals and competitive
> performance.

Installation
------------

Server-side installation (nodejs):

    $ npm install siphash

Browser-side: use `lib/siphash.min.js`.

Usage
-----

```javascript
var siphash = require("siphash"),
    key = siphash.string16_to_key("0123456789ABCDEF"),
    message = "Short test message",
    hash_hex = siphash.hash_hex(key, message);
```

A key is an array of 4 integers, and each of them will be clamped to
32 bits in order to build a 128-bit key.
For a random key, just generate 4 random integers instead of calling
`string16_to_key()`.

```javascript
var siphash = require("siphash"),
    key = [ 0xdeadbeef, 0xcafebabe, 0x8badf00d, 0x1badb002 ],
    message = "Short test message",
    hash_hex = siphash.hash_hex(key, message);
```

The 64-bit hash can also be obtained as two 32-bit values with
`hash(key, message)`:

```javascript
var siphash = require("siphash"),
    key = [ 0xdeadbeef, 0xcafebabe, 0x8badf00d, 0x1badb002 ],
    message = "Short test message",
    hash = siphash.hash(key, message),
    hash_msb = hash.h,
    hash_lsb = hash.l;
```

A 53-bit unsigned integer can be obtained with `hash_uint(key, message)`:

```javascript
var siphash = require("siphash"),
    key = siphash.string16_to_key("0123456789ABCDEF"),
    message = "Short test message",
    index = siphash.hash_uint(key, message);
```
