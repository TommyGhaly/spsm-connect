/**
 * Programming the church's NFC stickers: one `/c/<slug>` URL, then a password.
 *
 * The stickers are NXP NTAG213/215/216. Everything here is raw NTAG commands
 * sent through one `transceive` function, so the same code runs on iOS (Core
 * NFC's MIFARE command) and Android (NfcA), and nothing depends on either
 * platform's NDEF layer agreeing with the tag about what it is.
 *
 * ## What "locked" means
 *
 * Write-protected, not read-protected. A phone tapping the sticker must still
 * read the URL — that is the sticker's whole job. What the password stops is
 * somebody with a free NFC app rewriting a sticker in the narthex to point
 * anywhere they like.
 *
 * The password is turned into the tag's 4-byte PWD and 2-byte PACK by SHA-256,
 * so every character of it counts. A tag locked here can only be unlocked by
 * something that derives the key the same way — this screen — not by typing
 * the password into a general NFC app.
 */
import * as Crypto from 'expo-crypto';

/** Sends one NTAG command and returns the tag's reply. */
export type Transceive = (bytes: number[]) => Promise<number[]>;

export const TAG_PASSWORD = 'tommy#0';

/** The first page of user memory; pages 0–3 are the UID, lock bytes and CC. */
const FIRST_USER_PAGE = 4;

interface Model {
  name: string;
  /** CFG0. CFG1, PWD and PACK are the three pages after it. */
  cfgPage: number;
  /** The last page of user memory. */
  lastUserPage: number;
}

/** Keyed by GET_VERSION's storage-size byte. */
const MODELS: Record<number, Model> = {
  0x0f: { name: 'NTAG213', cfgPage: 0x29, lastUserPage: 0x27 },
  0x11: { name: 'NTAG215', cfgPage: 0x83, lastUserPage: 0x81 },
  0x13: { name: 'NTAG216', cfgPage: 0xe3, lastUserPage: 0xe1 },
};

export class TagError extends Error {}

// ── Raw commands ────────────────────────────────────────────────────────────

/** A one-byte reply whose low nibble is not 0xA is a NAK. */
function isNak(reply: number[]) {
  return reply.length === 1 && ((reply[0] ?? 0) & 0x0f) !== 0x0a;
}

async function getVersion(tx: Transceive): Promise<Model> {
  const v = await tx([0x60]);
  const model = v.length >= 7 && v[1] === 0x04 && v[2] === 0x04 ? MODELS[v[6] ?? -1] : undefined;
  if (!model) throw new TagError('Not an NTAG213/215/216 sticker.');
  return model;
}

/** READ returns four pages, sixteen bytes. */
async function read(tx: Transceive, page: number): Promise<number[]> {
  const reply = await tx([0x30, page]);
  if (reply.length < 16) throw new TagError(`Could not read page ${page}.`);
  return reply.slice(0, 16);
}

async function write(tx: Transceive, page: number, data: number[]) {
  const reply = await tx([0xa2, page, ...data.slice(0, 4)]);
  if (isNak(reply)) throw new TagError(`The tag refused a write to page ${page}.`);
}

async function authenticate(tx: Transceive, key: number[]) {
  let reply: number[];
  try {
    reply = await tx([0x1b, ...key.slice(0, 4)]);
  } catch {
    throw new TagError('Locked with a different password, so it cannot be removed here.');
  }
  const pack = key.slice(4, 6);
  if (reply.length < 2 || reply[0] !== pack[0] || reply[1] !== pack[1]) {
    throw new TagError('Locked with a different password, so it cannot be removed here.');
  }
}

// ── The password ────────────────────────────────────────────────────────────

/** PWD (4 bytes) then PACK (2 bytes), from SHA-256 of the password. */
export async function tagKey(password: string): Promise<number[]> {
  const hex = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, password);
  return Array.from({ length: 6 }, (_, i) => parseInt(hex.slice(i * 2, i * 2 + 2), 16));
}

/** AUTH0 is CFG0's last byte: the first page that needs the password. 0xFF is off. */
function isLocked(model: Model, cfg: number[]) {
  return (cfg[3] ?? 0xff) <= model.cfgPage + 3;
}

async function lock(tx: Transceive, model: Model, cfg: number[], key: number[]) {
  // AUTH0 goes last: until it is written, nothing is protected, so a sticker
  // pulled away halfway is left unlocked rather than locked with half a key.
  await write(tx, model.cfgPage + 2, key.slice(0, 4));
  await write(tx, model.cfgPage + 3, [...key.slice(4, 6), 0, 0]);
  const [access = 0, ...cfg1Rest] = cfg.slice(4, 8);
  // PROT off: the password guards writes, not reads.
  await write(tx, model.cfgPage + 1, [access & 0x7f, ...cfg1Rest]);
  await write(tx, model.cfgPage, [...cfg.slice(0, 3), FIRST_USER_PAGE]);
}

/**
 * Takes the password off a sticker: protection off, then PWD and PACK back to
 * the factory values. Needs a successful `authenticate` first.
 *
 * AUTH0 goes first here, the mirror of `lock`: once it is 0xFF nothing is
 * protected, so a sticker pulled away partway is left writable.
 */
async function unlock(tx: Transceive, model: Model, cfg: number[]) {
  await write(tx, model.cfgPage, [...cfg.slice(0, 3), 0xff]);
  await write(tx, model.cfgPage + 2, [0xff, 0xff, 0xff, 0xff]);
  await write(tx, model.cfgPage + 3, [0, 0, 0, 0]);
}

// ── NDEF ────────────────────────────────────────────────────────────────────

/** URI record prefix codes, longest first so the best one wins. */
const PREFIXES: [number, string][] = [
  [0x02, 'https://www.'],
  [0x01, 'http://www.'],
  [0x04, 'https://'],
  [0x03, 'http://'],
];

const PREFIX_BY_CODE = new Map(PREFIXES);

function ascii(text: string): number[] {
  return Array.from(new TextEncoder().encode(text));
}

/** An NDEF TLV holding one URI record, padded to whole pages. */
export function encodeUrl(url: string): number[] {
  const [code, prefix] = PREFIXES.find(([, p]) => url.startsWith(p)) ?? [0x00, ''];
  const payload = [code, ...ascii(url.slice(prefix.length))];
  if (payload.length > 255) throw new TagError('URL is too long for a sticker.');
  // MB | ME | SR, TNF well-known; type "U".
  const record = [0xd1, 0x01, payload.length, 0x55, ...payload];
  const length = record.length < 0xff ? [record.length] : [0xff, record.length >> 8, record.length & 0xff];
  const tlv = [0x03, ...length, ...record, 0xfe];
  while (tlv.length % 4) tlv.push(0x00);
  return tlv;
}

/** The URL in the first NDEF record, or null. Never throws on garbage. */
export function decodeUrl(memory: number[]): string | null {
  const at = (k: number) => memory[k] ?? 0;
  let i = 0;
  while (i < memory.length) {
    const t = at(i);
    if (t === 0x00) { i += 1; continue; }
    if (t === 0xfe) return null;
    let len = at(i + 1);
    let start = i + 2;
    if (len === 0xff) { len = (at(i + 2) << 8) | at(i + 3); start = i + 4; }
    if (t !== 0x03) { i = start + len; continue; }

    const header = at(start);
    if ((header & 0x07) !== 0x01) return null; // not a well-known record
    const typeLength = at(start + 1);
    const short = (header & 0x10) !== 0;
    const payloadLength = short
      ? at(start + 2)
      : ((at(start + 2) << 24) | (at(start + 3) << 16) | (at(start + 4) << 8) | at(start + 5)) >>> 0;
    let p = start + (short ? 3 : 6);
    const idLength = header & 0x08 ? at(p++) : 0;
    const type = at(p);
    p += typeLength + idLength;
    if (typeLength !== 1 || type !== 0x55) return null; // not "U"
    const payload = memory.slice(p, p + payloadLength);
    const [code, ...rest] = payload;
    if (code === undefined) return null;
    return (PREFIX_BY_CODE.get(code) ?? '') + String.fromCharCode(...rest);
  }
  return null;
}

async function readUrl(tx: Transceive, model: Model): Promise<string | null> {
  const memory: number[] = [];
  // 64 bytes holds any of the nine URLs several times over; stop early once a
  // terminator has been read.
  for (let page = FIRST_USER_PAGE; page <= model.lastUserPage && memory.length < 64; page += 4) {
    memory.push(...(await read(tx, page)));
    if (memory.includes(0xfe)) break;
  }
  return decodeUrl(memory);
}

async function writeUrl(tx: Transceive, model: Model, url: string) {
  const bytes = encodeUrl(url);
  const capacity = (model.lastUserPage - FIRST_USER_PAGE + 1) * 4;
  if (bytes.length > capacity) throw new TagError(`URL does not fit on an ${model.name}.`);
  for (let i = 0; i < bytes.length; i += 4) {
    await write(tx, FIRST_USER_PAGE + i / 4, bytes.slice(i, i + 4));
  }
}

// ── One sticker ─────────────────────────────────────────────────────────────

export type Outcome =
  | { kind: 'written'; url: string }
  | { kind: 'rewritten'; url: string; previous: string | null }
  | { kind: 'already'; url: string | null }
  | { kind: 'failed'; message: string };

/**
 * Programs one sticker that is already connected.
 *
 * A locked sticker is reported and left alone unless `rewrite` is set, so
 * tapping one twice by accident in a stack of twenty cannot change it.
 */
export async function programTag(
  tx: Transceive,
  url: string,
  key: number[],
  { rewrite }: { rewrite: boolean },
): Promise<Outcome> {
  try {
    const model = await getVersion(tx);
    const cfg = await read(tx, model.cfgPage);
    const locked = isLocked(model, cfg);

    if (locked) {
      const previous = await readUrl(tx, model).catch(() => null);
      if (!rewrite) return { kind: 'already', url: previous };
      // Password off, new URL on, password back on.
      await authenticate(tx, key);
      await unlock(tx, model, cfg);
      await writeUrl(tx, model, url);
      await lock(tx, model, cfg, key);
      return { kind: 'rewritten', url, previous };
    }

    await writeUrl(tx, model, url);
    await lock(tx, model, cfg, key);
    return { kind: 'written', url };
  } catch (error) {
    const message =
      error instanceof TagError
        ? error.message
        : 'Lost the sticker — hold it still until the phone confirms.';
    return { kind: 'failed', message };
  }
}
