// Link-card preview fetch (spec/40). Calls the worker's GET /api/unfurl,
// which server-side-fetches the page and extracts title / site / favicon /
// og:image (the static client can't read cross-origin page HTML). Fails
// SOFT — returns null on any error / non-200 so the card just shows the
// bare URL rather than blocking on the network.

import type { UnfurlResult } from '@livediagram/api-schema';
import { API_BASE } from './core';

export async function apiUnfurl(url: string): Promise<UnfurlResult | null> {
  try {
    const res = await fetch(`${API_BASE}/unfurl?url=${encodeURIComponent(url)}`);
    if (!res.ok) return null;
    return (await res.json()) as UnfurlResult;
  } catch {
    return null;
  }
}
