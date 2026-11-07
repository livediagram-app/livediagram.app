// @vitest-environment jsdom

// A connected tab's picture (connected-tabs.md "How it looks", IDX38): one index answer and one fetch per connection
// per page, the reader's Bearer and appearance for an item's picture, nothing for a pass's, nothing at all offline,
// `none` for any refusal or failure, and the oldest answers let go (their blob URLs revoked) past the cap.
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ConnectionOpen } from '@liveworkspace/index-client';
import { configureWorkbench, WORKBENCH_DEFAULTS } from '../../bindings';
import { testBindings } from '../../lib/testing/bindings';
import {
  CONNECTED_PREVIEW_CACHE_MAX,
  resetConnectedPreviews,
  useConnectedPreview,
} from './useConnectedPreview';

const connection = (id = 'cn_1') => ({ id, app: 'liveplanner', itemId: 'p1' }) as const;

const answer = (over: Partial<ConnectionOpen> = {}): ConnectionOpen => ({
  app: 'liveplanner',
  itemId: 'p1',
  name: 'Launch plan',
  href: 'https://www.liveplanner.app/s/code',
  via: 'link',
  level: 'edit',
  preview: '/api/previews/share/code/image.svg',
  ...over,
});

let fetched: { url: string; auth: string | null }[];
let created = 0;
const revoked: string[] = [];

beforeEach(() => {
  fetched = [];
  created = 0;
  revoked.length = 0;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: URL, init: RequestInit) => {
      fetched.push({ url: String(url), auth: new Headers(init.headers).get('Authorization') });
      return new Response('<svg/>', { status: 200 });
    }),
  );
  URL.createObjectURL = () => `blob:${++created}`;
  URL.revokeObjectURL = (src: string) => void revoked.push(src);
});

afterEach(() => {
  cleanup();
  resetConnectedPreviews();
  configureWorkbench(WORKBENCH_DEFAULTS);
  document.documentElement.classList.remove('dark');
  vi.unstubAllGlobals();
});

const grant = () => Promise.resolve('grant');
const clientOf = (open: ConnectionOpen | Error = answer()) => ({
  openConnection: vi.fn(() =>
    open instanceof Error ? Promise.reject(open) : Promise.resolve(open),
  ),
});

describe('useConnectedPreview', () => {
  it("draws a pass's live image with no credential, once per connection however many pages ask", async () => {
    const client = clientOf();
    const first = renderHook(() =>
      useConnectedPreview({ connection: connection(), grant, offline: false, client }),
    );
    const second = renderHook(() =>
      useConnectedPreview({ connection: connection(), grant, offline: false, client }),
    );
    expect(first.result.current).toEqual({ state: 'loading' });
    await waitFor(() => expect(first.result.current).toEqual({ state: 'ready', src: 'blob:1' }));
    await waitFor(() => expect(second.result.current).toEqual({ state: 'ready', src: 'blob:1' }));
    // Settled: a third page is drawn at once.
    const third = renderHook(() =>
      useConnectedPreview({ connection: connection(), grant, offline: false, client }),
    );
    expect(third.result.current).toEqual({ state: 'ready', src: 'blob:1' });
    expect(client.openConnection).toHaveBeenCalledTimes(1);
    expect(fetched).toEqual([
      { url: 'http://localhost:3000/api/previews/share/code/image.svg', auth: null },
    ]);
  });

  it("asks for the item's own picture with the reader's Bearer, in their appearance", async () => {
    configureWorkbench(
      testBindings({
        api: { ...WORKBENCH_DEFAULTS.api, currentBearer: () => Promise.resolve('token') },
      }),
    );
    document.documentElement.classList.add('dark');
    const client = clientOf(
      answer({ via: 'item', level: null, preview: '/api/previews/items/p1?v=5' }),
    );
    const { result } = renderHook(() =>
      useConnectedPreview({ connection: connection(), grant, offline: false, client }),
    );
    await waitFor(() => expect(result.current.state).toBe('ready'));
    expect(fetched).toEqual([
      {
        url: 'http://localhost:3000/api/previews/items/p1?v=5&appearance=dark',
        auth: 'Bearer token',
      },
    ]);
  });

  it('asks nothing offline', () => {
    const client = clientOf();
    const { result } = renderHook(() =>
      useConnectedPreview({ connection: connection(), grant, offline: true, client }),
    );
    expect(result.current).toEqual({ state: 'none' });
    expect(client.openConnection).not.toHaveBeenCalled();
  });

  it('is none without a grant, on a refusal, with no picture, or an empty or failed fetch', async () => {
    const cases: [() => Promise<string | null>, ReturnType<typeof clientOf>, () => void][] = [
      [() => Promise.resolve(null), clientOf(), () => {}],
      [grant, clientOf(new Error('gone')), () => {}],
      [grant, clientOf(answer({ preview: '' })), () => {}],
      [
        grant,
        clientOf(),
        () =>
          vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('', { status: 404 })),
          ),
      ],
      [
        grant,
        clientOf(),
        () =>
          vi.stubGlobal(
            'fetch',
            vi.fn(async () => new Response('', { status: 200 })),
          ),
      ],
    ];
    for (const [i, [g, client, arrange]] of cases.entries()) {
      arrange();
      const { result } = renderHook(() =>
        useConnectedPreview({
          connection: connection(`cn_${i}`),
          grant: g,
          offline: false,
          client,
        }),
      );
      await waitFor(() => expect(result.current).toEqual({ state: 'none' }));
    }
  });

  it('asks again after a failure rather than keeping it', async () => {
    const client = clientOf(new Error('network'));
    const first = renderHook(() =>
      useConnectedPreview({ connection: connection(), grant, offline: false, client }),
    );
    await waitFor(() => expect(first.result.current).toEqual({ state: 'none' }));
    first.unmount();
    renderHook(() =>
      useConnectedPreview({ connection: connection(), grant, offline: false, client }),
    );
    await waitFor(() => expect(client.openConnection).toHaveBeenCalledTimes(2));
  });

  it('lets the oldest go past the cap, revoking its picture', async () => {
    const client = clientOf();
    for (let i = 0; i <= CONNECTED_PREVIEW_CACHE_MAX; i++) {
      const { result, unmount } = renderHook(() =>
        useConnectedPreview({ connection: connection(`cn_${i}`), grant, offline: false, client }),
      );
      await waitFor(() => expect(result.current.state).toBe('ready'));
      unmount();
    }
    expect(revoked).toEqual(['blob:1']);
  });

  it('draws nothing once the page has gone', async () => {
    let release: (v: string) => void = () => {};
    const slow = () => new Promise<string>((resolve) => (release = resolve));
    const client = clientOf();
    const { result, unmount } = renderHook(() =>
      useConnectedPreview({ connection: connection(), grant: slow, offline: false, client }),
    );
    unmount();
    release('grant');
    await waitFor(() => expect(fetched).toHaveLength(1));
    expect(result.current).toEqual({ state: 'loading' });
  });
});
