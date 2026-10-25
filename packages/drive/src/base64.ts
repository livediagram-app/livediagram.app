// base64url without padding, for sealed tokens and signed state; plain base64 read too, for the key secret.

export function bytesToBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = '';
  for (const b of view) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Bytes from base64 or base64url, or null when the text isn't either. */
export function base64ToBytes(text: string): Uint8Array | null {
  const normal = text.replace(/-/g, '+').replace(/_/g, '/');
  if (!/^[A-Za-z0-9+/]*={0,2}$/.test(normal)) return null;
  try {
    const binary = atob(normal.padEnd(normal.length + ((4 - (normal.length % 4)) % 4), '='));
    return Uint8Array.from(binary, (c) => c.charCodeAt(0));
  } catch {
    return null;
  }
}

export const randomBase64Url = (bytes: number) =>
  bytesToBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
