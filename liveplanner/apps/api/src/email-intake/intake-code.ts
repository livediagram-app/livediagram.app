// A board address's code (docs/specs/026-plan/email-to-board.md "The address"; blueprint email-to-board.md "Domain and
// naming"): 16 random bytes in lowercase base32, so an address survives any mail server's case folding, behind
// `board-` on the intake domain.
import { EMAIL_INTAKE_PREFIX } from '@liveplanner/api-schema';

export const INTAKE_CODE_BYTES = 16;
// 128 bits in base32: 26 characters (the last one carries 3 bits).
export const INTAKE_CODE_LENGTH = 26;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyz234567';

/** Whether `code` has a code's shape: 26 of `a-z` and `2-7`. */
export function isIntakeCode(code: string): boolean {
  if (code.length !== INTAKE_CODE_LENGTH) return false;
  for (const c of code) if (!ALPHABET.includes(c)) return false;
  return true;
}

/** A fresh code. */
export function newIntakeCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(INTAKE_CODE_BYTES));
  let out = '';
  let bits = 0;
  let value = 0;
  for (const b of bytes) {
    value = ((value << 8) | b) & 0xfff;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

/** The code a recipient names on the intake domain, or null for any other address. */
export function codeOfRecipient(to: string, domain: string | undefined): string | null {
  if (!domain) return null;
  const address = to.trim().toLowerCase();
  const at = address.lastIndexOf('@');
  if (at < 0 || address.slice(at + 1) !== domain.toLowerCase()) return null;
  const local = address.slice(0, at);
  if (!local.startsWith(EMAIL_INTAKE_PREFIX)) return null;
  const code = local.slice(EMAIL_INTAKE_PREFIX.length);
  return isIntakeCode(code) ? code : null;
}

/** The hex SHA-256 of a lower-cased address: how a sender is counted, never kept as the address. */
export async function senderHash(address: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(address.trim().toLowerCase()),
  );
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
