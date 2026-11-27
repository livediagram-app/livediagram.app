// A Teams connect code (docs/specs/030-knowledgebase/chat-apps.md): eight letters as `XXXX-XXXX`.

// No 0, O, 1, I or L: a code is read off one screen and typed into another.
const CODE_LETTERS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
// The largest multiple of the alphabet's size a byte reaches: a byte at or above it would favour the first
// letters, so it is drawn again (rejection sampling keeps every letter equally likely).
const BYTE_LIMIT = 256 - (256 % CODE_LETTERS.length);

type RandomBytes = (bytes: Uint8Array) => Uint8Array;

const cryptoBytes: RandomBytes = (bytes) => crypto.getRandomValues(bytes);

export function newTeamsCode(random: RandomBytes = cryptoBytes): string {
  let letters = '';
  while (letters.length < CODE_LENGTH) {
    for (const b of random(new Uint8Array(CODE_LENGTH))) {
      if (b < BYTE_LIMIT && letters.length < CODE_LENGTH)
        letters += CODE_LETTERS[b % CODE_LETTERS.length];
    }
  }
  return `${letters.slice(0, 4)}-${letters.slice(4)}`;
}
