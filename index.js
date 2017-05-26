var merge = require('lodash.merge');
var dgram = require('unix-dgram');
var assert = require('assert-plus');
var os = require('os');
var util = require('util');
var sprintf = util.format;

/**
 * Options object provided when constructing a SyslogStream.
 * @typedef {object} SyslogStreamOptions
 * @property {int} [facility] - The syslog facility code to be used for log messages. Read more at {@link https://en.wikipedia.org/wiki/Syslog#Facility}.
 * @property {string} [name] - The name of the program or process that is generating the log messages. Read more at {@link https://en.wikipedia.org/wiki/Syslog#Message_.28MSG.29}.
 * @property {string} [path] - The path to the UNIX datagram domain socket to which the log messages will be sent.
 */

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
 * @param {SyslogStreamOptions} [options]
 * @constructor
 */
function SyslogStream(options) {

    assert.optionalObject(options, 'options');
    options = options || {};
    assert.optionalNumber(options.facility, 'options.facility');
    assert.optionalString(options.name, 'options.name');
    assert.optionalString(options.path, 'options.path');

    var defaultOptions = {
        facility: 16,
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

    this._socket = dgram.createSocket('unix_dgram');
    this._socket.once('connect', this._onConnection.bind(this));
    this._socket.on('congestion', this._onCongestion.bind(this));
    this._socket.on('writable', this._onWritable.bind(this));

    //todo: provide a more informative message on connect failure
    this._socket.connect(this._options.path);

}

function safeCycles() {

    //todo: quicker safeCycles method?
    var seen = [];

    function bunyanCycles(k, v) {
        if (!v || typeof (v) !== 'object') {
            return (v);
        }
        if (seen.indexOf(v) !== -1) {
            return ('[Circular]');
        }
        seen.push(v);
        return (v);
    }

    return (bunyanCycles);
}

SyslogStream.prototype._handleQueue = function () {

    var self = this;
    var queue = this._queue;
    this._queue = [];

    queue.forEach(function (buf) {
        self._send(buf);
    })

};

SyslogStream.prototype._onConnection = function () {
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

    var message = JSON.stringify(record, safeCycles());
    var hostname = record.hostname || HOSTNAME;
    var priority = (this._options.facility * 8) + level(record.level);
    var time = record.time;
    var name = this._options.name;
    var pid = process.pid;

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