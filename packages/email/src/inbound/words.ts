// Header words (liveworkspace/docs/specs/003-accounts/inbound-email.md "The reader"): RFC 2047 encoded words in a
// subject or a file name, and the bare address of a From value. Index scans, left to right.
import { decodeCharset, hexByte } from './mime';

// One `=?charset?B|Q?text?=` word at `at`, or null when the text there is not one.
function wordAt(s: string, at: number): { text: string; end: number } | null {
  const q1 = s.indexOf('?', at + 2);
  if (q1 < 0) return null;
  const mode = s[q1 + 1]?.toUpperCase();
  if ((mode !== 'B' && mode !== 'Q') || s[q1 + 2] !== '?') return null;
  const close = s.indexOf('?=', q1 + 3);
  if (close < 0) return null;
  // RFC 2231 lets a language follow the charset (`utf-8*en`): only the charset is read.
  const charset = s.slice(at + 2, q1).split('*')[0];
  const body = s.slice(q1 + 3, close);
  let bytes = '';
  if (mode === 'B') {
    const clean = body.replace(/[^A-Za-z0-9+/]/g, '');
    try {
      bytes = atob(clean.padEnd(Math.ceil(clean.length / 4) * 4, '='));
    } catch {
      return null;
    }
  } else {
    for (let i = 0; i < body.length; i++) {
      const c = body[i]!;
      const byte = c === '=' ? hexByte(body, i + 1) : -1;
      if (byte >= 0) {
        bytes += String.fromCharCode(byte);
        i += 2;
      } else bytes += c === '_' ? ' ' : c;
    }
  }
  return { text: decodeCharset(bytes, charset), end: close + 2 };
}

/** A header value with its encoded words decoded; the space between two encoded words is dropped, as the RFC says.
 *  The value is otherwise read as Latin-1 bytes, as headers arrive. */
export function decodeEncodedWords(value: string): string {
  let out = '';
  let at = 0;
  let lastWordEnd = -1;
  while (at < value.length) {
    const start = value.indexOf('=?', at);
    if (start < 0) break;
    const word = wordAt(value, start);
    if (!word) {
      out += value.slice(at, start + 2);
      at = start + 2;
      continue;
    }
    const between = value.slice(at, start);
    if (!(lastWordEnd === at && between.trim() === '')) out += between;
    out += word.text;
    at = word.end;
    lastWordEnd = at;
  }
  return out + value.slice(at);
}

/** The bare address of a From value (`Name <a@b.c>` or `a@b.c`), lower-cased, or null when there is none. */
export function addressOf(value: string | undefined): string | null {
  if (!value) return null;
  const open = value.lastIndexOf('<');
  const close = open < 0 ? -1 : value.indexOf('>', open);
  let address = open >= 0 && close > open ? value.slice(open + 1, close) : value;
  address = address.trim().toLowerCase();
  const at = address.indexOf('@');
  if (at < 1 || at !== address.lastIndexOf('@') || at === address.length - 1) return null;
  for (let i = 0; i < address.length; i++) {
    const c = address.charCodeAt(i);
    if (c <= 32 || c === 127 || address[i] === '<' || address[i] === '>' || address[i] === ',')
      return null;
  }
  return address;
}
