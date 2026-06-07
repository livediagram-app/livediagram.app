// Constant-time string comparison for share-password / share-code checks.
// A plain `a === b` short-circuits on the first differing byte, which —
// combined with an unthrottled read path — leaks the password a byte at a
// time via response timing. We SHA-256 both sides (so length is hidden and
// the compared buffers are always 32 bytes) and diff the digests without
// an early exit. The share password is a low-value, anti-URL-guessing
// secret (spec/24), so this is defence-in-depth, not a crypto guarantee.
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [da, db] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const ua = new Uint8Array(da);
  const ub = new Uint8Array(db);
  let diff = 0;
  for (let i = 0; i < ua.length; i++) diff |= ua[i]! ^ ub[i]!;
  return diff === 0;
}
