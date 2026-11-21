/**
 * The sticker programmer, against a simulated NTAG213.
 *
 * The simulator models what matters to `programTag`: GET_VERSION, READ, WRITE,
 * PWD_AUTH, and AUTH0 refusing writes until the right password has been sent.
 */
import { createHash as mockCreateHash } from 'crypto';

import { decodeUrl, encodeUrl, programTag, tagKey, type Transceive } from './ntag';

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: async (_: string, text: string) =>
    mockCreateHash('sha256').update(text).digest('hex'),
}));

const CFG = 0x29;
const PAGES = 0x2d;

function ntag213() {
  const mem = Array.from({ length: PAGES }, () => [0, 0, 0, 0]);
  mem[3] = [0xe1, 0x10, 0x12, 0x00]; // NDEF capability container
  mem[4] = [0x03, 0x00, 0xfe, 0x00]; // empty NDEF message
  mem[CFG] = [0x04, 0x00, 0x00, 0xff]; // AUTH0 = 0xFF: unprotected
  mem[CFG + 1] = [0x00, 0x05, 0x00, 0x00];
  mem[CFG + 2] = [0xff, 0xff, 0xff, 0xff];
  let authed = false;
  const writes: number[][] = [];

  const tx: Transceive = async ([cmd = 0, page = 0, ...data]) => {
    const auth0 = mem[CFG]![3]!;
    switch (cmd) {
      case 0x60:
        return [0x00, 0x04, 0x04, 0x02, 0x01, 0x00, 0x0f, 0x03];
      case 0x30: {
        const out: number[] = [];
        for (let p = page; p < page + 4; p++) {
          // PWD and PACK always read back as zeros.
          out.push(...(p === CFG + 2 || p === CFG + 3 ? [0, 0, 0, 0] : mem[p % PAGES]!));
        }
        return out;
      }
      case 0xa2:
        if (page >= auth0 && !authed) return [0x00];
        mem[page] = data.slice(0, 4);
        writes.push([page, ...data.slice(0, 4)]);
        return [0x0a];
      case 0x1b:
        if (mem[CFG + 2]!.every((b, i) => b === [page, ...data][i])) {
          authed = true;
          return mem[CFG + 3]!.slice(0, 2);
        }
        throw new Error('NAK');
      default:
        throw new Error(`unknown command ${cmd}`);
    }
  };

  return { tx, mem, writes, reset: () => { authed = false; } };
}

const URL_A = 'https://www.spsmwayland.org/c/give';
const URL_B = 'https://www.spsmwayland.org/c/forms';

describe('NDEF URL encoding', () => {
  it('round-trips with the https://www. prefix code', () => {
    const bytes = encodeUrl(URL_A);
    expect(bytes.length % 4).toBe(0);
    expect(bytes[6]).toBe(0x02); // TLV 03 len, record D1 01 len 'U', then the prefix code
    expect(decodeUrl(bytes)).toBe(URL_A);
  });

  it('reads an empty tag as no URL', () => {
    expect(decodeUrl([0x03, 0x00, 0xfe, 0x00])).toBeNull();
  });
});

describe('programTag', () => {
  it('writes and locks a blank sticker, then reports it as already programmed', async () => {
    const key = await tagKey('tommy#0');
    const tag = ntag213();

    expect(await programTag(tag.tx, URL_A, key, { rewrite: false })).toEqual({ kind: 'written', url: URL_A });
    expect(tag.mem[CFG]![3]).toBe(4); // AUTH0 protects from the first user page
    expect(tag.mem[CFG + 1]![0]! & 0x80).toBe(0); // reads stay open

    tag.reset();
    expect(await programTag(tag.tx, URL_B, key, { rewrite: false })).toEqual({ kind: 'already', url: URL_A });
  });

  it('removes the password before rewriting, then locks again', async () => {
    const key = await tagKey('tommy#0');
    const tag = ntag213();
    await programTag(tag.tx, URL_A, key, { rewrite: false });
    tag.reset();

    expect(await tag.tx([0xa2, 4, 0, 0, 0, 0])).toEqual([0x00]);

    tag.writes.length = 0;
    expect(await programTag(tag.tx, URL_B, key, { rewrite: true })).toEqual({
      kind: 'rewritten',
      url: URL_B,
      previous: URL_A,
    });

    // The first write switches protection off (AUTH0 = 0xFF) and clears the
    // password, before any page of the URL is touched.
    expect(tag.writes[0]).toEqual([CFG, 0x04, 0x00, 0x00, 0xff]);
    expect(tag.writes[1]).toEqual([CFG + 2, 0xff, 0xff, 0xff, 0xff]);
    const firstUrlWrite = tag.writes.findIndex(([page]) => page === 4);
    expect(firstUrlWrite).toBeGreaterThan(2);

    // ...and it ends locked again, with the new URL on it.
    expect(tag.mem[CFG]![3]).toBe(4);
    tag.reset();
    expect(await tag.tx([0xa2, 4, 0, 0, 0, 0])).toEqual([0x00]);
    expect(await programTag(tag.tx, URL_A, key, { rewrite: false })).toEqual({ kind: 'already', url: URL_B });
  });

  it('fails cleanly on a sticker locked with another password', async () => {
    const tag = ntag213();
    await programTag(tag.tx, URL_A, await tagKey('someone else'), { rewrite: false });
    tag.reset();

    expect(await programTag(tag.tx, URL_B, await tagKey('tommy#0'), { rewrite: true })).toEqual({
      kind: 'failed',
      message: 'Locked with a different password, so it cannot be removed here.',
    });
  });
});
