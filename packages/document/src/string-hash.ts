// FNV-1a over a string's UTF-16 code units, as an unsigned 32-bit number: the one small, stable,
// non-cryptographic hash for deterministic picks (a palette colour, an animation phase, stand-in
// glyphs) that must match on every device and render.

export function fnv1aString(s: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
