// Constant-time string comparison, so checking a Worker key can't leak it a byte at a time. Hashing
// both sides first makes the lengths equal, so a length mismatch leaks nothing either.
export async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  const enc = new TextEncoder();
  const [x, y] = await Promise.all([
    crypto.subtle.digest('SHA-256', enc.encode(a)),
    crypto.subtle.digest('SHA-256', enc.encode(b)),
  ]);
  const u = new Uint8Array(x);
  const v = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < u.length; i++) diff |= (u[i] ?? 0) ^ (v[i] ?? 0);
  return diff === 0;
}
