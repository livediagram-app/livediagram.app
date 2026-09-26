// The Explorer's Activity page (docs/specs/013-workspace/activity-page.md): what is outstanding for the
// reader across every diagram they can open.
//
// Read-only: every row links into the editor, where completing /
// resolving already live. Offline Mode (docs/specs/006-diagram/offline-mode.md) is a deliberate no-op
// here for the same reason as the Timeline: this endpoint is scoped to
// an owner, not a diagram id, and a browser-only diagram never reaches
// the worker, so it has no rows to show.

import type { ActivityReadResult } from '@livediagram/api-schema';
import { API_BASE, apiFetch, apiHeaders } from './core';

// Null means the read FAILED (offline, a lapsed token, a worker 500),
// as opposed to an empty result, which means nothing is outstanding.
// The two are different answers on an inbox: "we couldn't ask" must
// not render as "you have nothing to do".
export async function apiListActivity(ownerId: string): Promise<ActivityReadResult | null> {
  try {
    const res = await apiFetch(`${API_BASE}/activity`, {
      headers: await apiHeaders(ownerId),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as Partial<ActivityReadResult>;
    return {
      actions: Array.isArray(body.actions) ? body.actions : [],
      threads: Array.isArray(body.threads) ? body.threads : [],
    };
  } catch {
    return null;
  }
}
