// A calendar feed's token (docs/specs/026-plan/calendar-feed.md "The feed link"; blueprint calendar-feed.md): the
// secret in a feed link, the whole proof a calendar app's fetch carries. 32 random bytes, base64url, behind `lpf_`,
// so it is never mistaken for an `lwt_` API token and opens nothing but its one feed. The plan keeps only its
// SHA-256.

export const FEED_TOKEN_PREFIX = 'lpf_';
export const FEED_TOKEN_BYTES = 32;

// `lpf_` and 43 base64url characters (32 bytes, unpadded).
export const FEED_TOKEN_PATTERN = /^lpf_[A-Za-z0-9_-]{43}$/;

/** A fresh feed token, shown once to the person it is made for. */
export function newFeedToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(FEED_TOKEN_BYTES));
  const base64url = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `${FEED_TOKEN_PREFIX}${base64url}`;
}

/** The token's SHA-256 as lowercase hex: what the plan stores and looks a fetch up by. */
export async function feedTokenHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
