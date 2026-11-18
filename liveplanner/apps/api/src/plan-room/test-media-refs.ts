// The media service's references for tests (liveworkspace/docs/specs/006-media/media.md "References", "Unconfirmed
// references", "Releases"): a fake behind `fetch` that keeps references, confirmed and unconfirmed, and answers a
// release as the real one does, so a picture it "deletes" is one the real service would have deleted. Not a
// `.test.ts` file, so vitest does not collect it; only tests import it.

import { vi } from 'vitest';

export const MEDIA_URL = 'https://media.test/api/media';

export type RefsEntry = { document: string; images: string[] };

export type FakeMediaRefs = {
  refs: Map<string, Set<string>>;
  pending: Map<string, Set<string>>;
  deleted: string[];
  // Plans whose own report the fake refuses, as a plan whose report keeps failing.
  refusing: Set<string>;
  // Refuse every sync that vouches for another plan.
  refusePending: boolean;
  syncs: { documents: RefsEntry[]; pending?: RefsEntry[] }[];
};

const named = (id: string, within: Map<string, Set<string>>) =>
  [...within.values()].some((set) => set.has(id));

// Stub `fetch` with a fresh fake and answer its state; vi.unstubAllGlobals() takes it away.
export function stubMediaRefs(): FakeMediaRefs {
  const media: FakeMediaRefs = {
    refs: new Map(),
    pending: new Map(),
    deleted: [],
    refusing: new Set(),
    refusePending: false,
    syncs: [],
  };
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init?: RequestInit) => {
      const u = new URL(String(url));
      if (u.pathname.endsWith('/app/refs')) {
        const body = JSON.parse(init?.body as string) as {
          documents: RefsEntry[];
          pending?: RefsEntry[];
        };
        const { documents: own } = body;
        if (own.some((d) => media.refusing.has(d.document)))
          return Response.json({ error: 'down' }, { status: 503 });
        if (media.refusePending && body.pending?.length)
          return Response.json({ error: 'down' }, { status: 503 });
        media.syncs.push(body);
        for (const p of body.pending ?? [])
          if (!media.refs.get(p.document)?.size)
            media.pending.set(
              p.document,
              new Set([...(media.pending.get(p.document) ?? []), ...p.images]),
            );
        for (const d of own) {
          media.refs.set(d.document, new Set(d.images));
          media.pending.delete(d.document);
        }
        return Response.json({ ok: true });
      }
      if (u.pathname.endsWith('/release')) {
        const id = decodeURIComponent(u.pathname.split('/').at(-2)!);
        if (named(id, media.refs)) return Response.json({ released: false, reason: 'referenced' });
        if (named(id, media.pending))
          return Response.json({ released: false, reason: 'unconfirmed' });
        media.deleted.push(id);
        return Response.json({ released: true });
      }
      return Response.json({ error: 'not_found' }, { status: 404 });
    }),
  );
  return media;
}
