import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DesignComponent } from '@livedesign/design';
import {
  apiLoadComponents,
  apiPatchComponent,
  apiPutComponent,
  cloudPutComponent,
} from './components';
import {
  __setOfflineBackend,
  offlineCreateDesign,
  offlineLoadComponents,
} from '../offline/offline-store';
import { memBackend } from '../offline/offline-test-utils';

const main: DesignComponent = {
  id: 'c1',
  name: 'Header',
  width: 100,
  height: 40,
  elements: [{ id: 'a', type: 'shape', shape: 'square', x: 0, y: 0, width: 100, height: 40 }],
  updatedAt: 1,
};

function stubFetch(body: unknown, status = 200) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, init: RequestInit) => {
      calls.push({ url, init });
      return Promise.resolve(Response.json(body, { status }));
    }),
  );
  return calls;
}

describe('component library calls', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    __setOfflineBackend(null);
  });

  it('loads the mains, skipping one that does not validate', async () => {
    const calls = stubFetch({ components: [main, { ...main, id: 'bad/id' }] });
    expect(await apiLoadComponents('o', 'd1', 'SHARE')).toEqual([main]);
    expect(calls[0]!.url).toMatch(/\/designs\/d1\/components$/);
  });

  it('answers none when the design has no library yet (404)', async () => {
    stubFetch({ error: 'not_found' }, 404);
    expect(await apiLoadComponents('o', 'd1', null)).toEqual([]);
  });

  it('puts a main and patches one by element', async () => {
    const calls = stubFetch({ component: main });
    expect(await apiPutComponent('o', 'd1', main, null)).toEqual(main);
    expect(calls[0]!.init.method).toBe('PUT');
    expect(calls[0]!.url).toMatch(/\/designs\/d1\/components\/c1$/);
    expect(await cloudPutComponent('o', 'd1', main, null)).toEqual(main);
    await apiPatchComponent('o', 'd1', 'c1', { name: 'Nav' }, null, main);
    expect(calls[2]!.init.method).toBe('PATCH');
    expect(JSON.parse(calls[2]!.init.body as string)).toEqual({ name: 'Nav' });
  });

  it('keeps a This Browser design library in its record', async () => {
    __setOfflineBackend(memBackend());
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const id = 'offline-d1';
    await offlineCreateDesign({ id, name: 'Doc', tabs: [] }, 100);
    expect(await apiLoadComponents('o', id, null)).toEqual([]);
    await apiPutComponent('o', id, main, null);
    const renamed = { ...main, name: 'Nav', updatedAt: 2 };
    expect(await apiPatchComponent('o', id, 'c1', { name: 'Nav' }, null, renamed)).toEqual(renamed);
    expect(await offlineLoadComponents(id)).toEqual([renamed]);
    expect(await offlineLoadComponents('nope')).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
