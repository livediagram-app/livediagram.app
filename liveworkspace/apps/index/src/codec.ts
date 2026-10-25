// Small encodings: list cursors, share codes, search patterns, page sizes, base64url.

import { LIST_LIMIT_DEFAULT, LIST_LIMIT_MAX } from '@liveworkspace/index-client';
import { ID_MAX } from './config';

export function bytesToBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const byte of view) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function base64UrlToBytes(text: string): Uint8Array | null {
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

// A page's place in its sort: the last row's sort value and id, opaque to the caller.
export type Cursor = { at: number; id: string };

export function encodeCursor(cursor: Cursor): string {
  return bytesToBase64Url(new TextEncoder().encode(JSON.stringify([cursor.at, cursor.id])));
}

// undefined when none was sent, null when one was sent but isn't ours.
export function decodeCursor(text: string | null): Cursor | null | undefined {
  if (text === null || text === '') return undefined;
  if (text.length > 400) return null;
  const bytes = base64UrlToBytes(text);
  if (!bytes) return null;
  try {
    const value = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (
      Array.isArray(value) &&
      value.length === 2 &&
      Number.isFinite(value[0]) &&
      typeof value[1] === 'string' &&
      value[1].length <= ID_MAX
    ) {
      return { at: value[0] as number, id: value[1] };
    }
  } catch {
    // Not ours.
  }
  return null;
}

// `limit` from a query: the default when absent, null when it isn't 1 to LIST_LIMIT_MAX.
export function parseLimit(text: string | null, fallback = LIST_LIMIT_DEFAULT): number | null {
  if (text === null || text === '') return fallback;
  const n = Number(text);
  return Number.isInteger(n) && n >= 1 && n <= LIST_LIMIT_MAX ? n : null;
}

// A LIKE pattern matching `text` anywhere, its own `%`, `_` and `\` taken literally (with ESCAPE '\').
export function containsPattern(text: string): string {
  return `%${text.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

// Share codes, as the apps have them: fourteen characters with no look-alike glyphs (no 0/O, 1/I/l). The
// alphabet is 32 characters, so a byte modulo it carries no bias.
const SHARE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const SHARE_CODE_LENGTH = 14;

export function generateShareCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(SHARE_CODE_LENGTH));
  let code = '';
  for (const byte of bytes) code += SHARE_ALPHABET[byte % SHARE_ALPHABET.length];
  return code;
}

export const isShareCode = (value: unknown): value is string =>
  typeof value === 'string' && /^[A-Za-z0-9]{4,64}$/.test(value);

export const isId = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= ID_MAX;
