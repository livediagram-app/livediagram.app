// The index's form rows as a test reaches them (forms/form-inbox.ts): `PUT /app/items/:id/forms/:tabId` and
// `.../seen`, `GET /app/forms/:code` and `.../seen/:personId`, kept in memory as liveworkspace/apps/index keeps
// them (a push without a code keeps the code; a seen count never goes back; null takes the row and its reads).
// Stubs the global fetch: restore with vi.unstubAllGlobals.
//
// Not a `.test.ts` file, so vitest doesn't collect it as a suite.

import { vi } from 'vitest';
import { INDEX_ON } from '../test-accounts';

type Row = { heading: string; responses: number; code: string | null };

export function stubFormIndex() {
  const forms = new Map<string, Row>();
  const seen = new Map<string, number>();
  vi.stubGlobal('fetch', async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const parts = url.pathname
      .replace(/^.*\/app\//, '')
      .split('/')
      .map(decodeURIComponent);
    const method = init?.method ?? 'GET';
    type Body = {
      form?: { heading: string; responses: number; code?: string } | null;
      personId?: string;
      seen?: number;
    };
    const body = (typeof init?.body === 'string' ? JSON.parse(init.body) : {}) as Body;
    const missing = () => Response.json({ error: 'not_found' }, { status: 404 });
    if (parts[0] === 'forms' && method === 'GET') {
      const hit = [...forms].find(([, row]) => row.code === parts[1]);
      if (!hit) return missing();
      const [itemId, tabId] = hit[0].split('/');
      return Response.json({ itemId, tabId });
    }
    if (parts[0] !== 'items' || parts[2] !== 'forms') return missing();
    const key = `${parts[1]}/${parts[3]}`;
    if (parts.length === 4 && method === 'PUT') {
      if (!body.form) {
        forms.delete(key);
        for (const k of [...seen.keys()]) if (k.startsWith(`${key}/`)) seen.delete(k);
      } else {
        const code = body.form.code ?? forms.get(key)?.code ?? null;
        forms.set(key, { heading: body.form.heading, responses: body.form.responses, code });
      }
      return new Response(null, { status: 204 });
    }
    if (parts.length === 5 && method === 'PUT') {
      const k = `${key}/${body.personId ?? ''}`;
      seen.set(k, Math.max(seen.get(k) ?? 0, body.seen ?? 0));
      return new Response(null, { status: 204 });
    }
    if (parts.length === 6 && method === 'GET') {
      return Response.json({ seen: seen.get(`${key}/${parts[5]}`) ?? 0 });
    }
    return missing();
  });
  return { env: INDEX_ON, forms, seen };
}
