// Each app's two Drive doors (liveworkspace/docs/specs/005-drive/drive.md "Contracts > The apps"), at
// `<APP_ORIGIN_<APP>>/api/internal/items/…` with the app's DRIVE_KEY: the item's whole-item envelope (and its
// drawing, for the thumbnail) out, and a new item from a file in. And where an item opens in its app.

import type { AppName } from '@liveworkspace/drive';
import { etagVersion } from '@liveworkspace/index-app';
import { APP_ITEMS } from '@liveworkspace/sites';
import { appKey, appOrigin, type Env } from './env';

export type ImportAnswer =
  | { ok: true; id: string }
  | { ok: false; error: 'invalid_file' | 'too_large' | 'not_configured' | 'failed' };

export interface AppDoors {
  // The item's envelope and its content version, or null when the app has no such item (404: skipped).
  exportFile(app: AppName, itemId: string): Promise<{ body: string; version: number } | null>;
  // The item's first tab drawn as SVG, or null when there is nothing to draw (or it can't be had).
  exportSvg(app: AppName, itemId: string): Promise<string | null>;
  importFile(
    app: AppName,
    input: { owner: string; folderId: string | null; name: string; file: string },
  ): Promise<ImportAnswer>;
  // Where the item opens, or null when the app's origin isn't configured.
  itemUrl(app: AppName, itemId: string): string | null;
}

// A render or a big item's export can take a while; past this the write is retried by a later pass.
export const DOOR_TIMEOUT_MS = 20_000;

export class DoorError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'DoorError';
    this.status = status;
  }
}

export function createAppDoors(
  env: Env,
  doFetch: typeof fetch = (i, init) => fetch(i, init),
): AppDoors {
  function door(app: AppName): { origin: string; key: string } {
    const origin = appOrigin(env, app);
    const key = appKey(env, app);
    if (!origin || !key) throw new DoorError(0, `drive: ${app} doors not configured`);
    return { origin, key };
  }

  async function exportCall(
    app: AppName,
    itemId: string,
    format: 'file' | 'svg',
  ): Promise<Response> {
    const { origin, key } = door(app);
    return doFetch(
      `${origin}/api/internal/items/${encodeURIComponent(itemId)}/export?format=${format}`,
      { headers: { Authorization: `Bearer ${key}` }, signal: AbortSignal.timeout(DOOR_TIMEOUT_MS) },
    );
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
        throw new DoorError(res.status, `drive: export ${res.status}`);
      }
      return { body: await res.text(), version };
    },

    async exportSvg(app, itemId) {
      const res = await exportCall(app, itemId, 'svg');
      if (res.status !== 200) {
        await res.body?.cancel();
        return null;
      }
      return res.text();
    },

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
        signal: AbortSignal.timeout(DOOR_TIMEOUT_MS),
      });
      const body = (await res.json().catch(() => null)) as { id?: unknown; error?: unknown } | null;
      if (res.status === 201 && typeof body?.id === 'string') return { ok: true, id: body.id };
      if (res.status === 400) return { ok: false, error: 'invalid_file' };
      if (res.status === 413) return { ok: false, error: 'too_large' };
      return { ok: false, error: 'failed' };
    },

    itemUrl(app, itemId) {
      const origin = appOrigin(env, app);
      return origin ? `${origin}${APP_ITEMS[app].itemPath}${encodeURIComponent(itemId)}` : null;
    },
  };
}
