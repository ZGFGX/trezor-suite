import crypto from 'crypto';
// @ts-ignore
import * as base58check from 'bs58check';
// note we only need base58 conversion fn from base58check, other functions from there might
// be supplemented from crypto module

import { getPrefixedURL } from '@suite-utils/router';
import { METADATA } from '@suite-actions/constants';
import { Deferred, createDeferred } from '@suite-utils/deferred';

const CIPHER_TYPE = 'aes-256-gcm';
const CIPHER_IVSIZE = 96 / 8;

export const deriveMetadataKey = (masterKey: string, xpub: string) => {
    const hmac = crypto.createHmac('sha256', Buffer.from(masterKey, 'hex'));
    hmac.update(xpub);
    const hash = hmac.digest();
    return base58check.encode(hash);
};

const deriveHmac = (metadataKey: string) => {
    const hmac = crypto.createHmac('sha512', metadataKey);
    const buf = Buffer.from('0123456789abcdeffedcba9876543210', 'hex');
    hmac.update(buf);
    return hmac.digest();
};

export const deriveAesKey = (metadataKey: string) => {
    const hash = deriveHmac(metadataKey);
    if (hash.length !== 64 && Buffer.byteLength(hash) !== 64) {
        throw new Error(
            `Strange buffer length when deriving account hmac ${hash.length} ; ${Buffer.byteLength(
                hash,
            )}`,
        );
    }
    const secondHalf = hash.slice(32, 64);
    return secondHalf.toString('hex');
};

export const deriveFilename = (metadataKey: string) => {
    const hash = deriveHmac(metadataKey);
    const firstHalf = hash.slice(0, 32);
    return firstHalf.toString('hex');
};

const getRandomIv = (): Promise<Buffer> => {
    return new Promise((resolve, reject) => {
        try {
            crypto.randomBytes(CIPHER_IVSIZE, (err, buf) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(buf);
                }
            });
        } catch (err) {
            reject(err);
        }
    });
};

export const getFileContent = (ab: ArrayBuffer) => {
    const isArrayBufferSupported = Buffer.from(new Uint8Array([1]).buffer)[0] === 1;
    if (isArrayBufferSupported) return Buffer.from(ab);
    const buffer = Buffer.alloc(ab.byteLength);
    const view = new Uint8Array(ab);
    for (let i = 0; i < buffer.length; ++i) {
        buffer[i] = view[i];
    }
    return buffer;
};

export const encrypt = async (input: Record<string, any>, aesKey: string | Buffer) => {
    if (typeof aesKey === 'string') {
        aesKey = Buffer.from(aesKey, 'hex');
    }
    const iv = await getRandomIv();
    const stringified = JSON.stringify(input);
    const buffer = Buffer.from(stringified, 'utf8');
    // @ts-ignore
    const cipher = crypto.createCipheriv(CIPHER_TYPE, aesKey, iv);
    const startCText = cipher.update(buffer);
    const endCText = cipher.final();
    // tag is always 128-bits
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, startCText, endCText]);
};

export const decrypt = (input: Buffer, key: string | Buffer) => {
    if (typeof key === 'string') {
        key = Buffer.from(key, 'hex');
    }

    const ivsize = CIPHER_IVSIZE;
    const iv = input.slice(0, ivsize);
    // tag is always 128-bits
    const authTag = input.slice(ivsize, ivsize + 128 / 8);
    const cText = input.slice(ivsize + 128 / 8);
    const decipher = crypto.createDecipheriv(CIPHER_TYPE, key, iv);
    const start = decipher.update(cText);

    // throws when tampered
    decipher.setAuthTag(authTag);
    const end = decipher.final();

    const res = Buffer.concat([start, end]);
    const stringified = res.toString('utf8');
    return JSON.parse(stringified);
};

export const urlHashParams = (hash: string) => {
    const result: { [param: string]: string } = {};
    if (!hash) return result;
    if (hash[0] === '#') {
        hash = hash.substring(1, hash.length);
    }
    const parts = hash.split('&');
    parts.forEach(part => {
        const [key, value] = part.split('=');
        result[key] = decodeURIComponent(value);
    });
    return result;
};

/**
 * For desktop, always use oauth_receiver.html from trezor.io
 * For web, use oauth_receiver.html hosted on the same origin (localhost/sldev/trezor.io)
 */
export const getOauthReceiverUrl = () => {
    // @ts-ignore
    if (!window.ipcRenderer) {
        return `${window.location.origin}${getPrefixedURL('/static/oauth/oauth_receiver.html')}`;
    }

    // todo: upload oauth_receiver.html from suite to trezor.io (it contains code to handle ipcRenderer);
    // return 'https://beta-wallet.trezor.io/oauth_receiver.html';
    // todo: temporarily herokuapp is used.
    return 'https://track-suite.herokuapp.com/oauth/';
};

export const getOauthToken = (url: string) => {
    console.log('getOauthToken orig');
    const dfd: Deferred<string> = createDeferred();
    // const props = WINDOW_PROPS + this._getRelativePosition();
    const props = METADATA.AUTH_WINDOW_PROPS;

    const onMessage = (e: MessageEvent) => {
        // filter non oauth messages
        if (
            ![
                'herokuapp.com', // todo: remove
                'wallet.trezor.io',
                'beta-wallet.trezor.io',
                window.location.origin,
            ].includes(e.origin)
        ) {
            return;
        }

        if (typeof e.data !== 'string') return;

        const params = urlHashParams(e.data);

        const token = params.access_token;
        const { state } = params;

        console.warn('TOKEN', token, state);

        if (token) {
            dfd.resolve(token);
        } else {
            dfd.reject(new Error('Cancelled'));
        }
    };

    // @ts-ignore
    const { ipcRenderer } = global;
    if (ipcRenderer) {
        const onIpcMessage = (_sender: any, message: any) => {
            onMessage({ ...message, origin: 'herokuapp.com' });
            ipcRenderer.off('oauth', onIpcMessage);
        };
        ipcRenderer.on('oauth', onIpcMessage);
    } else {
        window.addEventListener('message', onMessage);
    }

    window.open(url, METADATA.AUTH_WINDOW_TITLE, props);

    return dfd.promise;
};
