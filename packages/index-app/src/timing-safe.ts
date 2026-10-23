// Constant-time string comparison for keys and share secrets: both sides are hashed (so length is hidden and the
// compared buffers are always 32 bytes) and the digests diffed without an early exit.
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

// Whether a request carries `Authorization: Bearer <key>`.
export async function bearerMatches(request: Request, key: string): Promise<boolean> {
  const header = request.headers.get('Authorization') ?? '';
  const sent = header.startsWith('Bearer ') ? header.slice(7) : '';
  return sent.length > 0 && (await timingSafeEqual(sent, key));
}
