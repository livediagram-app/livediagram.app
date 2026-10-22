// Constant-time comparison of two secrets of any length: both sides are hashed first, so
// neither the content nor the length leaks through timing.
export async function sameSecret(a: string, b: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [x, y] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(a)),
    crypto.subtle.digest('SHA-256', encoder.encode(b)),
  ]);
  return crypto.subtle.timingSafeEqual(x, y);
}

// The header the client-registration route sends to prove admin rights to the OAuth
// provider's privilege checks (auth-options.ts `clientPrivileges`).
export const ADMIN_HEADER = 'x-liveworkspace-admin';
