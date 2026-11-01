// The calls liveworkspace's services make on each app's internal doors, built once (liveworkspace/docs/specs/005-drive/
// drive.md "Contracts > The apps", liveworkspace/docs/specs/003-accounts/data-export.md "The apps"): an item's
// whole-item file, a tab drawn as SVG, its boards and sheets as CSV, its comment threads, a new item from a file, and
// where an item opens. Each caller hands in its own origins and keys (the Drive mirror its DRIVE_KEY_<APP>, the data
// export its DATA_EXPORT_KEY_<APP>), so one client serves both and each key opens only what the app lets it.

import { etagVersion, type ExportTable, type ExportThread } from '@liveworkspace/index-app';
import type { App } from '@liveworkspace/index-client';
import { APP_ITEMS } from '@liveworkspace/sites';

export type ImportAnswer =
  | { ok: true; id: string }
  | { ok: false; error: 'invalid_file' | 'too_large' | 'not_configured' | 'failed' };

export type ImportInput = { owner: string; folderId: string | null; name: string; file: string };

export interface AppDoors {
  // The item's envelope and its content version, or null when the app has no such item (404: skipped).
  exportFile(app: App, itemId: string): Promise<{ body: string; version: number } | null>;
  // One tab (the first without `tabId`) drawn as SVG, or null when there is nothing to draw (or it can't be had).
  exportSvg(app: App, itemId: string, tabId?: string): Promise<string | null>;
  // The item's boards and sheets as CSV, or null for an app without them or an item that is gone (404).
  exportTables(app: App, itemId: string): Promise<ExportTable[] | null>;
  // Every comment thread in the item, or null for an item that is gone (404).
  exportComments(app: App, itemId: string): Promise<ExportThread[] | null>;
  importFile(app: App, input: ImportInput): Promise<ImportAnswer>;
  // Where the item opens, or null when the app's origin isn't configured.
  itemUrl(app: App, itemId: string): string | null;
}

export type AppDoorsConfig = {
  // Each app's origin (no trailing slash) and the caller's key on its doors; either unset leaves that app unreachable.
  origin: (app: App) => string | undefined;
  key: (app: App) => string | undefined;
  // Who is calling, in error messages (`drive`, `export`).
  caller: string;
  timeoutMs?: number;
};

// A render or a big item's export can take a while; past this the caller tries again later.
export const DOOR_TIMEOUT_MS = 20_000;

export class DoorError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'DoorError';
    this.status = status;
  }
}

// A JSON answer's field, read defensively: an app answering something else is a door failure, not a crash.
async function jsonField<T>(res: Response, field: string, caller: string): Promise<T> {
  const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  const value = body?.[field];
  if (!Array.isArray(value)) throw new DoorError(res.status, `${caller}: malformed ${field}`);
  return value as T;
}

/** How the doors reach an app: a URL and its request, always. `fetch` itself fits. */
export type DoorFetch = (url: string, init?: RequestInit) => Promise<Response>;

export function createAppDoors(
  config: AppDoorsConfig,
  doFetch: DoorFetch = (url, init) => fetch(url, init),
): AppDoors {
  const { caller } = config;
  const timeoutMs = config.timeoutMs ?? DOOR_TIMEOUT_MS;

  function door(app: App): { origin: string; key: string } {
    const origin = config.origin(app);
    const key = config.key(app);
    if (!origin || !key) throw new DoorError(0, `${caller}: ${app} doors not configured`);
    return { origin, key };
  }

  async function exportCall(
    app: App,
    itemId: string,
    format: 'file' | 'svg' | 'csv' | 'comments',
    tabId?: string,
  ): Promise<Response> {
    const { origin, key } = door(app);
    const tab = tabId ? `&tab=${encodeURIComponent(tabId)}` : '';
    return doFetch(
      `${origin}/api/internal/items/${encodeURIComponent(itemId)}/export?format=${format}${tab}`,
      { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(timeoutMs) },
    );
  }

  // A JSON format's answer: its list, null for a 404, a DoorError for anything else.
  async function listCall<T>(
    app: App,
    itemId: string,
    format: 'csv' | 'comments',
    field: string,
  ): Promise<T | null> {
    const res = await exportCall(app, itemId, format);
    if (res.status === 404) {
      await res.body?.cancel();
      return null;
    }
    if (res.status !== 200) {
      await res.body?.cancel();
      throw new DoorError(res.status, `${caller}: export ${format} ${res.status}`);
    }
    return jsonField<T>(res, field, caller);
  }

  return {
    async exportFile(app, itemId) {
      const res = await exportCall(app, itemId, 'file');
      if (res.status === 404) {
        await res.body?.cancel();
        return null;
      }
      const version = etagVersion(res.headers.get('ETag'));
      if (res.status !== 200 || version === null) {
        await res.body?.cancel();
        throw new DoorError(res.status, `${caller}: export ${res.status}`);
      }
      return { body: await res.text(), version };
    },

    async exportSvg(app, itemId, tabId) {
      const res = await exportCall(app, itemId, 'svg', tabId);
      if (res.status !== 200) {
        await res.body?.cancel();
        return null;
      }
      return res.text();
    },

    exportTables: (app, itemId) => listCall<ExportTable[]>(app, itemId, 'csv', 'tables'),

    exportComments: (app, itemId) => listCall<ExportThread[]>(app, itemId, 'comments', 'threads'),

    async importFile(app, input) {
      let origin: string;
      let key: string;
      try {
        ({ origin, key } = door(app));
      } catch {
        return { ok: false, error: 'not_configured' };
      }
      const res = await doFetch(`${origin}/api/internal/items/import`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        signal: AbortSignal.timeout(timeoutMs),
      });
      const body = (await res.json().catch(() => null)) as { id?: unknown } | null;
      if (res.status === 201 && typeof body?.id === 'string') return { ok: true, id: body.id };
      if (res.status === 400) return { ok: false, error: 'invalid_file' };
      if (res.status === 413) return { ok: false, error: 'too_large' };
      return { ok: false, error: 'failed' };
    },

    itemUrl(app, itemId) {
      const origin = config.origin(app);
      return origin ? `${origin}${APP_ITEMS[app].itemPath}${encodeURIComponent(itemId)}` : null;
    },
  };
}
