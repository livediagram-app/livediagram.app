import { afterEach, describe, expect, it, vi } from 'vitest';
import { appKey, appOrigin, setting, type Env } from './env';
import { createSources, EXPORT_DELEGATE, SourceError } from './sources';

type Call = { url: string; init?: RequestInit };

function binding(answer: (url: string) => Response) {
  const calls: Call[] = [];
  const fetcher = {
    fetch: vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, init });
      return answer(url);
    }),
  } as unknown as Fetcher;
  return { fetcher, calls };
}

const headersOf = (call: Call) => new Headers(call.init?.headers);

const ENV: Env = {
  INDEX_KEY_EXPORT: 'ik',
  MEDIA_KEY_EXPORT: 'mk',
  EXPORT_KEY_ACCOUNTS: 'ak',
  APP_ORIGIN_LIVEPLANNER: 'https://plan.test/',
  DATA_EXPORT_KEY_LIVEPLANNER: ' dk ',
};

afterEach(() => vi.unstubAllGlobals());

describe('env', () => {
  it('reads settings, origins and keys', () => {
    expect(setting('  ')).toBeUndefined();
    expect(setting(undefined)).toBeUndefined();
    expect(appOrigin(ENV, 'liveplanner')).toBe('https://plan.test');
    expect(appOrigin(ENV, 'livediagram')).toBeUndefined();
    expect(appKey(ENV, 'liveplanner')).toBe('dk');
  });

  it('has no origin or key for a held app', () => {
    expect(appOrigin(ENV, 'livehuddle')).toBeUndefined();
    expect(appKey(ENV, 'livehuddle')).toBeUndefined();
  });
});

describe('listItems', () => {
  it('lists a person’s items as the export delegate, and keeps only good rows', async () => {
    const { fetcher, calls } = binding(() =>
      Response.json({
        items: [
          { id: 'a', app: 'livediagram', title: 'A', updatedAt: 5 },
          { id: 'b', app: 'livediagram' },
          { id: 'c', app: 'nope' },
          { app: 'livediagram' },
        ],
        nextCursor: 'n1',
      }),
    );
    let counted = 0;
    const sources = createSources({ ...ENV, INDEX: fetcher }, () => counted++);
    const page = await sources.listItems(
      { kind: 'personal', personId: 'user_ada' },
      'user_ada',
      null,
    );
    expect(page).toEqual({
      items: [
        { id: 'a', app: 'livediagram', name: 'A', updatedAt: 5 },
        { id: 'b', app: 'livediagram', name: '', updatedAt: 0 },
      ],
      nextCursor: 'n1',
    });
    expect(counted).toBe(1);
    const h = headersOf(calls[0]!);
    expect(h.get('Authorization')).toBe('Bearer ik');
    expect(h.get('X-Index-App')).toBe(EXPORT_DELEGATE);
    expect(h.get('X-Index-Person')).toBe('user_ada');
    expect(h.get('X-Index-Teams')).toBeNull();
    expect(calls[0]!.url).not.toContain('cursor');
  });

  it('lists a team’s items as the admin, with the cursor, and ends on the last page', async () => {
    const { fetcher, calls } = binding(() => Response.json({}));
    const sources = createSources({ INDEX: fetcher });
    const page = await sources.listItems(
      { kind: 'team', teamId: 't1', teamName: 'D' },
      'user_ada',
      'c1',
    );
    expect(page).toEqual({ items: [], nextCursor: null });
    expect(calls[0]!.url).toContain('cursor=c1');
    const h = headersOf(calls[0]!);
    expect(h.get('X-Index-Teams')).toBe('t1');
    expect(h.get('Authorization')).toBe('Bearer');
  });

  it('fails on a refusal, and without a binding', async () => {
    const { fetcher } = binding(() => new Response('no', { status: 403 }));
    await expect(
      createSources({ INDEX: fetcher }).listItems({ kind: 'personal', personId: 'p' }, 'p', null),
    ).rejects.toThrow('index list 403');
    await expect(
      createSources({}).listItems({ kind: 'personal', personId: 'p' }, 'p', null),
    ).rejects.toThrow(SourceError);
  });
});

describe('images', () => {
  it('lists a person’s images and reads their bytes', async () => {
    const { fetcher, calls } = binding((url) =>
      url.endsWith('/bytes')
        ? new Response(new Uint8Array([1, 2]))
        : Response.json({ images: [{ id: 'i1' }] }),
    );
    const sources = createSources({ ...ENV, MEDIA: fetcher });
    expect(await sources.listImages('user ada')).toEqual([{ id: 'i1' }]);
    expect(calls[0]!.url).toContain('owner=user%20ada');
    expect(headersOf(calls[0]!).get('X-Media-App')).toBe('export');
    expect(headersOf(calls[0]!).get('Authorization')).toBe('Bearer mk');
    expect([...(await sources.imageBytes('i1'))!]).toEqual([1, 2]);
  });

  it('answers no images for an odd list, null for a gone image, and fails on refusals', async () => {
    let status = 200;
    const { fetcher } = binding(() =>
      status === 200 ? Response.json({}) : new Response('x', { status }),
    );
    const sources = createSources({ MEDIA: fetcher });
    expect(await sources.listImages('p')).toEqual([]);
    status = 404;
    expect(await sources.imageBytes('i')).toBeNull();
    status = 500;
    await expect(sources.listImages('p')).rejects.toThrow('media list 500');
    await expect(sources.imageBytes('i')).rejects.toThrow('media bytes 500');
  });
});

describe('ready', () => {
  it('tells accounts, and fails when accounts refuses', async () => {
    let status = 204;
    const { fetcher, calls } = binding(() => new Response(null, { status }));
    const sources = createSources({ ...ENV, ACCOUNTS: fetcher });
    const call = { key: 'personal:p', exportId: 'ex', requestedBy: 'p', status: 'ready' as const };
    await sources.ready(call as never);
    expect(calls[0]!.url).toBe('https://accounts/api/account/internal/data-export/ready');
    expect(headersOf(calls[0]!).get('Authorization')).toBe('Bearer ak');
    expect(JSON.parse(String(calls[0]!.init?.body))).toEqual(call);
    status = 500;
    await expect(sources.ready(call as never)).rejects.toThrow('accounts ready 500');
    await expect(createSources({ ACCOUNTS: fetcher }).ready(call as never)).rejects.toThrow(
      'accounts ready 500',
    );
  });
});

describe('doors', () => {
  it('reach the app through fetch, counted', async () => {
    const fetchMock = vi.fn(async () => Response.json({ tables: [] }));
    vi.stubGlobal('fetch', fetchMock);
    let counted = 0;
    const sources = createSources(ENV, () => counted++);
    expect(await sources.doors.exportTables('liveplanner', 'p1')).toEqual([]);
    expect(counted).toBe(1);
    expect(String((fetchMock.mock.calls[0] as unknown[])[0])).toContain(
      'https://plan.test/api/internal/items/p1/export',
    );
  });
});
