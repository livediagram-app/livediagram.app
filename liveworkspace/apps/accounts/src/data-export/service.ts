// The export service, as accounts calls it (liveworkspace/docs/specs/003-accounts/data-export.md "The service"): through
// its EXPORT service binding, with EXPORT_KEY_ACCOUNTS. Either unset, there is no service and the doors answer 503.
import {
  EXPORT_SERVICE_PATH,
  type ExportView,
  type StartExportCall,
} from '@liveworkspace/data-export';
import type { Env } from '../env.ts';

export interface ExportService {
  start(
    call: StartExportCall,
  ): Promise<{ ok: true; view: ExportView } | { ok: false; error: 'export_running' }>;
  status(keys: readonly string[]): Promise<Record<string, ExportView | null>>;
  // The zip and its export id, or null when there is none ready.
  file(key: string): Promise<{ body: ReadableStream; size: number; exportId: string } | null>;
  remove(key: string): Promise<void>;
}

export class ServiceError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`export service ${status}`);
    this.status = status;
    this.name = 'ServiceError';
  }
}

// The binding never looks the host up.
const BASE = 'https://export';

export function exportService(
  env: Pick<Env, 'EXPORT' | 'EXPORT_KEY_ACCOUNTS'>,
): ExportService | null {
  const binding = env.EXPORT;
  const key = env.EXPORT_KEY_ACCOUNTS?.trim();
  if (!binding || !key) return null;
  const call = (path: string, init: RequestInit = {}) =>
    binding.fetch(`${BASE}${EXPORT_SERVICE_PATH}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    });
  const keyPath = (k: string) => `/${encodeURIComponent(k)}`;

  return {
    async start(body) {
      const res = await call('', { method: 'POST', body: JSON.stringify(body) });
      if (res.status === 409) {
        await res.body?.cancel();
        return { ok: false, error: 'export_running' };
      }
      if (res.status !== 202) {
        await res.body?.cancel();
        throw new ServiceError(res.status);
      }
      return { ok: true, view: ((await res.json()) as { export: ExportView }).export };
    },
    async status(keys) {
      const res = await call('/status', { method: 'POST', body: JSON.stringify({ keys }) });
      if (!res.ok) {
        await res.body?.cancel();
        throw new ServiceError(res.status);
      }
      return ((await res.json()) as { exports: Record<string, ExportView | null> }).exports;
    },
    async file(k) {
      const res = await call(`${keyPath(k)}/file`);
      if (res.status === 404 || !res.body) {
        await res.body?.cancel();
        return null;
      }
      if (!res.ok) {
        await res.body.cancel();
        throw new ServiceError(res.status);
      }
      return {
        body: res.body,
        size: Number(res.headers.get('Content-Length') ?? 0),
        exportId: res.headers.get('X-Export-Id') ?? '',
      };
    },
    async remove(k) {
      const res = await call(keyPath(k), { method: 'DELETE' });
      await res.body?.cancel();
      if (!res.ok) throw new ServiceError(res.status);
    },
  };
}
