# Bunyan Syslog Unix Datagram

A syslog stream for [bunyan](https://github.com/trentm/node-bunyan) that works without requiring
any configuration to the syslog daemon.

In most UNIX systems, syslog is automatically configured to be listening at a UNIX datagram
domain socket (most likely /var/log), so any messages sent there will be logged by syslog.
This stream connects to datagram domain sockets, so unlike other bunyan syslog stream
implementations, you won't have to go and change your syslog config file to enable a
TCP/UDP server.

It just works, which makes it easier to use for beginners.

## Installation

    npm install bunyan-syslog-unixdgram

## Usage

```javascript
var bunyan = require('bunyan');
var SyslogStream = require('bunyan-syslog-unixdgram');

var stream = new SyslogStream({
    name: 'myAppName',
    facility: SyslogStream.facility.local6,
    path: '/dev/log'
});

var log = bunyan.createLogger({
	name: 'foo',
	streams: [ {
		level: 'debug',
		type: 'raw', // Always use 'raw' bunyan stream
		stream: stream
	}]
});

log.debug({foo: 'bar'}, 'hello %s', 'world');
```

## Stream Options

An options object can be provided when instantiating the stream object.
It can contain the following properties:

1. name: name that is used in the tag portion of the syslog log messages header. Defaults to process.title || process.argv[0].
2. facility: syslog facility for the log messages. Defaults to 1 (user facility).
3. path: The path to the UNIX datagram domain socket to which the log messages will be sent. Defaults to /dev/log.

## Mappings

This module maps bunyan levels to syslog levels as follows:

```
+--------+--------+
| Bunyan | Syslog |
+--------+--------+
| fatal  | emerg  |
+--------+--------+
| error  | error  |
+--------+--------+
| warn   | warn   |
+--------+--------+
| info   | info   |
+--------+--------+
| *      | debug  |
+--------+--------+
```

## License

MIT.
