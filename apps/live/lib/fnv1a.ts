// FNV-1a, 32-bit: a fast, stable, non-cryptographic hash of a string's UTF-16
// code units. For deterministic picks and fingerprints, never for security.
export function fnv1a32(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
