// A short, stable hash of text: the same input answers the same 16 hex characters in a Worker, in Node and in a
// browser, synchronously (WebCrypto's digests are async, and a passage id is made inside a save). Not a secret and
// not collision-proof against an attacker: it names passages and tells whether a passage's text changed.

const PART_END = 0x1f;

/** 64 bits of hash over `parts`, as 16 hex characters. Parts are kept apart, so ('ab', 'c') is not ('a', 'bc'). */
export function stableHash(...parts: readonly string[]): string {
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  const mix = (code: number) => {
    h1 = Math.imul(h1 ^ code, 2654435761);
    h2 = Math.imul(h2 ^ code, 1597334677);
  };
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) mix(part.charCodeAt(i));
    mix(PART_END);
    mix(part.length);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  return hex(h2) + hex(h1);
}
