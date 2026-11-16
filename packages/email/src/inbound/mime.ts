// A message's MIME parts (liveworkspace/docs/specs/003-accounts/inbound-email.md "The reader"; blueprint
// inbound-email.md "Behaviour and state"): headers unfolded, multiparts split on their boundaries, bodies decoded from
// base64 or quoted-printable, text read in its charset. The message is held as a byte string (one character per
// byte), so every scan is an index walk over it; nothing here uses a pattern that can backtrack.

// Parts kept in all, and how deep multiparts may nest: past either, the rest are left out.
export const INBOUND_PARTS_MAX = 50;
export const INBOUND_DEPTH_MAX = 8;

export type MimeHeaders = ReadonlyMap<string, string>;

export type MimePart = {
  headers: MimeHeaders;
  // The Content-Type's `type/subtype`, lower-cased (`text/plain` when none is given).
  type: string;
  params: Readonly<Record<string, string>>;
  // The body as it stands in the message (still transfer-encoded), as a byte string.
  raw: string;
  children: MimePart[];
};

const CHUNK = 0x8000;

/** The bytes as a byte string: one character per byte, so indexes are byte offsets. Built a chunk at a time (an
 *  apply's argument list stays well under any engine's limit), the chunks joined once. */
export function byteString(bytes: Uint8Array): string {
  const parts: string[] = [];
  for (let at = 0; at < bytes.length; at += CHUNK)
    parts.push(
      String.fromCharCode.apply(null, bytes.subarray(at, at + CHUNK) as unknown as number[]),
    );
  return parts.join('');
}

/** A byte string's bytes. */
export function bytesOf(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xff;
  return out;
}

// The end of the line starting at `at` (the index of its LF, or `end`), and the line without its CR.
function lineAt(s: string, at: number, end: number): { stop: number; line: string } {
  let stop = s.indexOf('\n', at);
  if (stop < 0 || stop > end) stop = end;
  const lineEnd = stop > at && s.charCodeAt(stop - 1) === 13 ? stop - 1 : stop;
  return { stop, line: s.slice(at, lineEnd) };
}

const isFold = (line: string) => line.length > 0 && (line[0] === ' ' || line[0] === '\t');

/** The headers between `start` and the first empty line (unfolded, names lower-cased, the first of each kept), and
 *  where the body starts. A block with no empty line is all headers. */
export function readHeaders(
  s: string,
  start = 0,
  end = s.length,
): { headers: Map<string, string>; bodyStart: number } {
  const headers = new Map<string, string>();
  let name: string | null = null;
  let value = '';
  const flush = () => {
    if (name !== null && !headers.has(name)) headers.set(name, value.trim());
    name = null;
  };
  let at = start;
  while (at < end) {
    const { stop, line } = lineAt(s, at, end);
    at = stop + 1;
    if (line === '') {
      flush();
      return { headers, bodyStart: Math.min(at, end) };
    }
    if (isFold(line)) {
      if (name !== null) value += ` ${line.trim()}`;
      continue;
    }
    flush();
    const colon = line.indexOf(':');
    if (colon <= 0) continue;
    name = line.slice(0, colon).trim().toLowerCase();
    value = line.slice(colon + 1);
  }
  flush();
  return { headers, bodyStart: end };
}

/** A header value's main token (lower-cased) and its `name=value` parameters, read left to right: quoted values with
 *  backslash escapes, and RFC 2231's `name*=charset''%XX` and `name*0*=` continuations put back together. */
export function headerParams(value: string): { main: string; params: Record<string, string> } {
  let at = value.indexOf(';');
  if (at < 0) at = value.length;
  const main = value.slice(0, at).trim().toLowerCase();
  const plain: Record<string, string> = {};
  const pieces = new Map<string, { index: number; encoded: boolean; text: string }[]>();
  while (at < value.length) {
    at++;
    const eq = value.indexOf('=', at);
    const semi = value.indexOf(';', at);
    if (eq < 0 || (semi >= 0 && semi < eq)) {
      if (semi < 0) break;
      at = semi;
      continue;
    }
    const key = value.slice(at, eq).trim().toLowerCase();
    let text = '';
    let i = eq + 1;
    while (i < value.length && (value[i] === ' ' || value[i] === '\t')) i++;
    if (value[i] === '"') {
      i++;
      while (i < value.length && value[i] !== '"') {
        if (value[i] === '\\' && i + 1 < value.length) i++;
        text += value[i];
        i++;
      }
      const next = value.indexOf(';', i);
      at = next < 0 ? value.length : next;
    } else {
      const next = value.indexOf(';', i);
      at = next < 0 ? value.length : next;
      text = value.slice(i, at).trim();
    }
    if (!key) continue;
    const star = key.indexOf('*');
    if (star < 0) {
      if (!(key in plain)) plain[key] = text;
      continue;
    }
    const base = key.slice(0, star);
    const rest = key.slice(star + 1);
    const encoded = rest.endsWith('*') || rest === '';
    const index = rest === '' || rest === '*' ? 0 : Number.parseInt(rest, 10);
    if (!Number.isFinite(index)) continue;
    const list = pieces.get(base) ?? [];
    list.push({ index, encoded, text });
    pieces.set(base, list);
  }
  for (const [base, list] of pieces) {
    list.sort((a, b) => a.index - b.index);
    plain[base] = joinExtended(list);
  }
  return { main, params: plain };
}

// RFC 2231: the first piece may carry `charset'language'`; encoded pieces are percent-escaped bytes in that charset.
function joinExtended(list: readonly { encoded: boolean; text: string }[]): string {
  let charset = 'utf-8';
  let bytes = '';
  list.forEach((piece, n) => {
    let text = piece.text;
    if (n === 0 && piece.encoded) {
      const first = text.indexOf("'");
      const second = first < 0 ? -1 : text.indexOf("'", first + 1);
      if (second >= 0) {
        charset = text.slice(0, first) || charset;
        text = text.slice(second + 1);
      }
    }
    bytes += piece.encoded ? percentBytes(text) : text;
  });
  return decodeCharset(bytes, charset);
}

function percentBytes(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const hex = text[i] === '%' ? hexByte(text, i + 1) : -1;
    if (hex >= 0) {
      out += String.fromCharCode(hex);
      i += 2;
    } else out += text[i];
  }
  return out;
}

function hexDigit(c: number): number {
  if (c >= 48 && c <= 57) return c - 48;
  if (c >= 65 && c <= 70) return c - 55;
  if (c >= 97 && c <= 102) return c - 87;
  return -1;
}

/** The byte two hex digits at `at` name, or -1. */
export function hexByte(s: string, at: number): number {
  if (at + 1 >= s.length) return -1;
  const hi = hexDigit(s.charCodeAt(at));
  const lo = hexDigit(s.charCodeAt(at + 1));
  return hi < 0 || lo < 0 ? -1 : hi * 16 + lo;
}

/** A byte string read in `charset` (UTF-8 when it names none or one the runtime lacks); never throws. */
export function decodeCharset(bytes: string, charset: string | undefined): string {
  const label = (charset ?? '').trim().toLowerCase() || 'utf-8';
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder(label);
  } catch {
    decoder = new TextDecoder('utf-8');
  }
  return decoder.decode(bytesOf(bytes));
}

const NOT_BASE64 = /[^A-Za-z0-9+/]/g;

/** A part's body bytes (a byte string) out of its transfer encoding: base64 (junk skipped), quoted-printable (soft
 *  breaks joined, a broken `=` kept), anything else as it stands. */
export function decodeBody(raw: string, encoding: string | undefined): string {
  const kind = (encoding ?? '').trim().toLowerCase();
  if (kind === 'base64') {
    // One character class, no repeat to backtrack: linear in the body.
    let clean = raw.replace(NOT_BASE64, '');
    clean = clean.slice(0, clean.length - (clean.length % 4 === 1 ? 1 : 0));
    // A lone last character was dropped above, so the padded text always decodes.
    while (clean.length % 4 !== 0) clean += '=';
    return atob(clean);
  }
  if (kind === 'quoted-printable') {
    // Runs between `=` copied whole; each `=` is a soft break, an escaped byte, or kept as it stands.
    let out = '';
    let at = 0;
    for (;;) {
      const eq = raw.indexOf('=', at);
      if (eq < 0) return out + raw.slice(at);
      out += raw.slice(at, eq);
      if (raw[eq + 1] === '\n') at = eq + 2;
      else if (raw[eq + 1] === '\r' && raw[eq + 2] === '\n') at = eq + 3;
      else {
        const byte = hexByte(raw, eq + 1);
        if (byte < 0) {
          out += '=';
          at = eq + 1;
        } else {
          out += String.fromCharCode(byte);
          at = eq + 3;
        }
      }
    }
  }
  return raw;
}

type Budget = { parts: number };

function partAt(s: string, start: number, end: number, depth: number, budget: Budget): MimePart {
  budget.parts++;
  const { headers, bodyStart } = readHeaders(s, start, end);
  const { main, params } = headerParams(headers.get('content-type') ?? 'text/plain');
  const type = main.includes('/') ? main : 'text/plain';
  const part: MimePart = { headers, type, params, raw: s.slice(bodyStart, end), children: [] };
  const boundary = params['boundary'];
  if (!type.startsWith('multipart/') || !boundary || depth >= INBOUND_DEPTH_MAX) return part;
  for (const [from, to] of sections(s, bodyStart, end, boundary)) {
    if (budget.parts >= INBOUND_PARTS_MAX) break;
    part.children.push(partAt(s, from, to, depth + 1, budget));
  }
  return part;
}

// The byte ranges between a multipart's `--boundary` lines, up to the closing `--boundary--` (or the end): the
// preamble and epilogue left out, and the line break before each delimiter counted as the delimiter's.
function sections(s: string, start: number, end: number, boundary: string): [number, number][] {
  const open = `--${boundary}`;
  const close = `${open}--`;
  const out: [number, number][] = [];
  let partStart = -1;
  let at = start;
  while (at < end) {
    const lineStart = at;
    const { stop, line } = lineAt(s, at, end);
    at = stop + 1;
    if (!line.startsWith(open)) continue;
    const trimmed = line.trimEnd();
    if (trimmed !== open && trimmed !== close) continue;
    if (partStart >= 0) {
      let partEnd = lineStart;
      if (partEnd > partStart && s.charCodeAt(partEnd - 1) === 10) partEnd--;
      if (partEnd > partStart && s.charCodeAt(partEnd - 1) === 13) partEnd--;
      out.push([partStart, partEnd]);
    }
    if (trimmed === close) return out;
    partStart = Math.min(at, end);
  }
  if (partStart >= 0 && partStart < end) out.push([partStart, end]);
  return out;
}

/** The message's part tree. */
export function parseMime(message: string): MimePart {
  return partAt(message, 0, message.length, 0, { parts: 0 });
}

/** Every leaf part, in order (a multipart's children, depth first). */
export function leavesOf(part: MimePart): MimePart[] {
  if (part.children.length === 0) return part.type.startsWith('multipart/') ? [] : [part];
  return part.children.flatMap(leavesOf);
}
