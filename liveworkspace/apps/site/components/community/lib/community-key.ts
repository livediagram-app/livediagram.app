import { isCommunityKey } from '@liveworkspace/community';

// The per-browser community key (liveworkspace/docs/specs/007-community/community.md "Public routes"): a random UUID
// that keys one like and one report per browser per post. Deliberately NOT a guest owner id: a public page must never
// put an owner credential on the wire, so this module reads only its own key, under the app's `storageKey`.
//
// Read from localStorage, minted with crypto.randomUUID when missing or malformed. When storage is blocked (private
// mode, a sandboxed frame) the key lives in memory for the page's life, so likes still work until the tab closes.
// SSR-safe: on the server there is no key.

let memoryKey: string | null = null;

function mint(): string {
  return crypto.randomUUID();
}

export function getCommunityKey(storageKey: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    const stored = window.localStorage.getItem(storageKey);
    if (isCommunityKey(stored)) return stored;
    const key = memoryKey ?? mint();
    window.localStorage.setItem(storageKey, key);
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
