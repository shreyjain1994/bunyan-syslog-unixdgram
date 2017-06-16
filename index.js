"use strict";

var merge = require('lodash.merge');
var dgram = require('unix-dgram');
var assert = require('assert-plus');
var os = require('os');
var util = require('util');
var sprintf = util.format;
var stringify = require('json-stringify-safe');

var HOSTNAME = os.hostname();

/**
 * Converts bunyan log level to syslog log level.
 * @param {int} level - Bunyan log level.
 * @returns {int} Syslog log level.
 */
function level(level) {

    var syslog = {
        EMERG: 0,
        ERR: 3,
        WARNING: 4,
        INFO: 6,
        DEBUG: 7
    };

    var bunyan = {
        FATAL: 60,
        ERROR: 50,
        WARN: 40,
        INFO: 30,
        DEBUG: 20,
        TRACE: 10
    };

    var sysl;

    switch (level) {
        case bunyan.FATAL:
            sysl = syslog.EMERG;
            break;

        case bunyan.ERROR:
            sysl = syslog.ERR;
            break;

        case bunyan.WARN:
            sysl = syslog.WARNING;
            break;

        case bunyan.INFO:
            sysl = syslog.INFO;
            break;

        default:
            sysl = syslog.DEBUG;
            break;
    }

    return (sysl);
}

/**
 * Create a new syslog stream.
 * @param{int} [options.facility] - The syslog facility code to be used for log messages. Read more at {@link https://en.wikipedia.org/wiki/Syslog#Facility}. Defaults to 1 (user facility).
 * @param {string} [options.name] - The name of the program or process that is generating the log messages. Read more at {@link https://en.wikipedia.org/wiki/Syslog#Message_.28MSG.29}. Defaults to process.title || process.argv[0].
 * @param {string} [options.path] - The path to the UNIX datagram domain socket to which the log messages will be sent. Defaults to /dev/log.
 * @constructor
 */
function SyslogStream(options) {

    assert.optionalObject(options, 'options');
    options = options || {};
    assert.optionalNumber(options.facility, 'options.facility');
    assert.optionalString(options.name, 'options.name');
    assert.optionalString(options.path, 'options.path');

    var defaultOptions = {
        facility: 1,
        name: process.title || process.argv[0],
        path: '/dev/log'
    };

    /**
     * @type {SyslogStreamOptions}
     * @private
     */
    this._options = merge(defaultOptions, options);

    /**
     * Messages that are queued to be sent.
     * @type {Buffer[]}
     * @private
     */
    this._queue = [];

    /**
     * Whether the socket is connected to the unix domain.
     * @type {boolean}
     * @private
     */
    this._connected = false;

    /**
     * Whether the socket is congested and thus cannot accept any more messages right now.
     * @type {boolean}
     * @private
     */
    this._congested = false;

    /**
     * Socket connected to the UNIX domain.
     * @private
     */
    this._socket = dgram.createSocket('unix_dgram');

    /**
     * Function to be run on socket connection error. This is done so that users of
     * this stream will receive more informative exception messages when the socket fails to connect.
     * @type {function}
     * @private
     */
    this._boundOnConnectionFailure = this._onConnectionFailure.bind(this);

    this._socket.on('error', this._boundOnConnectionFailure);
    this._socket.once('connect', this._onConnectionSuccess.bind(this));
    this._socket.on('congestion', this._onCongestion.bind(this));
    this._socket.on('writable', this._onWritable.bind(this));

    this._socket.connect(this._options.path);

}

SyslogStream.prototype._handleQueue = function () {

    var self = this;
    var queue = this._queue;
    this._queue = [];

    queue.forEach(function (buf) {
        self._send(buf);
    })

};

SyslogStream.prototype._onConnectionFailure = function (err) {

    var errMsg;
    var path = this._options.path;

    switch (-err.errno) {
        case 2:
            errMsg = path + ' does not exist. Provide a path to a socket that does exist';
            break;
        case 13:
            errMsg = 'Access was denied to the socket located at ' + path + '. Ensure your user has write privileges to the socket';
            break;
        case 91:
            errMsg = path + ' is not a dgram socket. You may be trying to connect to a stream socket. Ensure the socket uses the datagram protocol.';
            break;
        default:
            errMsg = "Failed to connect to " + path + '. The errno code was ' + (-err.errno) + '.';
            break;
    }
    throw new Error(errMsg);
};

SyslogStream.prototype._onConnectionSuccess = function () {

    //remove listener that is checking for connection error since connection has succeeded
    this._socket.removeListener('error', this._boundOnConnectionFailure);

    this._connected = true;
    this._handleQueue();
};

SyslogStream.prototype._onCongestion = function (buf) {
    this._congested = true;
    this._queue.push(buf);
};

SyslogStream.prototype._onWritable = function () {
    this._congested = false;
    this._handleQueue();
};

SyslogStream.prototype.write = function (record) {

    //todo: allow custom functions for creating header and message
    if (typeof record !== 'object') {
        throw new Error("Use 'raw' log messages when setting up this stream for Bunyan.")
    }

    var message = stringify(record);
    var hostname = record.hostname || HOSTNAME;
    var priority = (this._options.facility * 8) + level(record.level);
    var time = record.time;
    var name = this._options.name;
    var pid = process.pid;

    //todo: ensure header format works with different versions of syslog or atleast try?
    var header = sprintf('<%d>%s %s %s[%d]:', priority, time, hostname, name, pid);
    this._send(new Buffer(header + message + '\n', 'utf-8'))
};

SyslogStream.prototype._send = function (buf) {
    if (!this._connected || this._congested) {
        this._queue.push(buf);
    }
    else {
        this._socket.send(buf);
    }
};

module.exports = SyslogStream;
module.exports.facility = {
    kern: 0,
    user: 1,
    mail: 2,
    daemon: 3,
    auth: 4,
    syslog: 5,
    lpr: 6,
    news: 7,
    uucp: 8,
    authpriv: 10,
    ftp: 11,
    cron: 15,
    local0: 16,
    local1: 17,
    local2: 18,
    local3: 19,
    local4: 20,
    local5: 21,
    local6: 22,
    local7: 23
};