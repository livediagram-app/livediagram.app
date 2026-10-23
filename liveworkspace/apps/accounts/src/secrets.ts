// Constant-time comparison of two secrets of any length: both sides are hashed first, so
// neither the content nor the length leaks through timing.
export async function sameSecret(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [x, y] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ]);
  // workerd's own comparison; elsewhere (node, the tests) the same thing without an early exit.
  const subtle = crypto.subtle as SubtleCrypto & {
    timingSafeEqual?: (a: ArrayBuffer, b: ArrayBuffer) => boolean;
  };
  if (subtle.timingSafeEqual) return subtle.timingSafeEqual(x, y);
  const ux = new Uint8Array(x);
  const uy = new Uint8Array(y);
  let diff = 0;
  for (let i = 0; i < ux.length; i++) diff |= ux[i]! ^ uy[i]!;
  return diff === 0;
}

// The header the client-registration route sends to prove admin rights to the OAuth
// provider's privilege checks (auth-options.ts `clientPrivileges`).
export const ADMIN_HEADER = 'x-liveworkspace-admin';
