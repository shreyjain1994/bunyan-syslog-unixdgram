/// <reference types="node" />

import stream = require('stream');

export = BunyanSyslogUnixdgram;

declare class BunyanSyslogUnixdgram extends stream.Writable {
    constructor(options?: BunyanSyslogUnixdgram.Options);
}

declare namespace BunyanSyslogUnixdgram {
    export const facility: {
        auth: number;
        authpriv: number;
        cron: number;
        daemon: number;
        ftp: number;
        kern: number;
        local0: number;
        local1: number;
        local2: number;
        local3: number;
        local4: number;
        local5: number;
        local6: number;
        local7: number;
        lpr: number;
        mail: number;
        news: number;
        syslog: number;
        user: number;
        uucp: number;
    };

    export interface Options {
        facility?: number,
        name?: string,
        path?: string
    }

}
