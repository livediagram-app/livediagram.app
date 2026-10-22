import { COMMUNITY_KEY_STORAGE, isCommunityKey } from '@livediagram/api-schema';

// The per-browser community key (docs/specs/025-community/community.md "Likes"; blueprint §5): a
// random UUID that keys one like and one report per browser per post. Deliberately NOT the guest owner
// id (`livediagram:v2:self-id`): a public page must never put an owner credential on the wire, so this
// module never reads that key.
//
// Read from localStorage, minted with crypto.randomUUID when missing or malformed. When storage is
// blocked (private mode, a sandboxed frame) the key lives in memory for the page's life, so likes
// still work until the tab closes. SSR-safe: on the server there is no key.

let memoryKey: string | null = null;

function mint(): string {
  return crypto.randomUUID();
}

export function getCommunityKey(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(COMMUNITY_KEY_STORAGE);
    if (isCommunityKey(stored)) return stored;
    const key = memoryKey ?? mint();
    window.localStorage.setItem(COMMUNITY_KEY_STORAGE, key);
    memoryKey = key;
    return key;
  } catch {
    memoryKey ??= mint();
    return memoryKey;
  }
}

// Test seam: forget the in-memory fallback between cases.
export function resetCommunityKeyForTests(): void {
  memoryKey = null;
}
