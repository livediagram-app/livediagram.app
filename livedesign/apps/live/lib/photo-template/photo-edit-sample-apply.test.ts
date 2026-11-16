import 'fake-indexeddb/auto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { decodeBlobBatch, type PhotoBlobEntry } from '@livedesign/api-schema';
import { pagesOf, photosOf, type Tab } from '@livedesign/design';
import { templateCanvasOverrides } from '@livedesign/templates';

// docs/specs/031-photo/photo-pages.md "The Photo Edit template": asked for by the template's pick, stored the
// store's own way (the api for a cloud design, this browser for an Offline Mode one), then set.
const offline = new Set<string>();
vi.mock('../offline/offline-ids', () => ({
  isOfflineId: async (id: string) => offline.has(id),
}));
vi.mock('../api/core', () => ({
  API_BASE: 'https://api.test/api',
  apiFetch: (...a: Parameters<typeof fetch>) => fetch(...a),
  apiHeaders: async () => ({}),
}));

const { applyAskedPhotoEditSample, askForPhotoEditSample, photoEditSampleAsked } =
  await import('./photo-edit-sample-apply');
const { PhotoUploadQueue, apiTransport } = await import('../photo-editor/upload-queue');
const { offlineBlobsFor } = await import('../photo-editor/offline-blobs');

const ids = {
  picture: 'picture_______________',
  storyMask: 'storyMask_____________',
  postMask: 'postMask______________',
  storyPreview: 'storyPreview__________',
  postPreview: 'postPreview___________',
};
const entries: PhotoBlobEntry[] = Object.values(ids).map((id, i) => ({
  id,
  type: 'image/jpeg',
  bytes: new Uint8Array([0xff, 0xd8, 0xff, i]),
}));
const landed = (id: string): Tab => ({
  id,
  name: 'Photo Edit',
  elements: [],
  ...templateCanvasOverrides('photo-edit'),
});

// The editor's wiring over one tab: its tabs, the real queue over the real blob client, and what happened in order.
function editor(tab: Tab, designId: string) {
  let tabs = [tab];
  const order: string[] = [];
  const queue = new PhotoUploadQueue(async () => {});
  queue.setTransport(apiTransport(() => ({ ownerId: 'p_owner', designId, shareCode: null })));
  const load = vi.fn(async () => ({ ids, entries }));
  const deps = {
    load,
    enqueue: (tabId: string, e: readonly PhotoBlobEntry[]) => {
      order.push('enqueue');
      queue.enqueue(tabId, e);
    },
    settled: async (tabId: string) => {
      await queue.whenSettled(tabId);
      order.push('stored');
    },
    commit: (tabId: string, map: (t: Tab) => Tab) => {
      order.push('set');
      tabs = tabs.map((t) => (t.id === tabId ? map(t) : t));
    },
  };
  return { deps, load, order, tab: () => tabs[0]! };
}

afterEach(() => {
  vi.unstubAllGlobals();
  offline.clear();
});

describe('the Photo Edit sample set on its tab', () => {
  it('in a cloud design: uploaded for the tab, then set', async () => {
    const posted: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: RequestInit) => {
        if (url.endsWith('/photo-blobs-held')) return new Response(JSON.stringify({ has: [] }));
        const batch = decodeBlobBatch(new Uint8Array(init.body as ArrayBuffer));
        if (typeof batch === 'string') throw new Error(batch);
        posted.push(url, ...batch.map((e) => e.id));
        return new Response(JSON.stringify({ stored: [] }));
      }),
    );
    const e = editor(landed('cloud-tab'), 'd-cloud');
    askForPhotoEditSample('cloud-tab');
    expect(await applyAskedPhotoEditSample(e.tab(), e.deps)).toBe(true);
    expect(posted[0]).toBe('https://api.test/api/designs/d-cloud/tabs/cloud-tab/photo-blobs');
    expect(posted.slice(1).sort()).toEqual(Object.values(ids).sort());
    expect(e.order).toEqual(['enqueue', 'stored', 'set']);
    expect(pagesOf(e.tab())).toHaveLength(2);
    expect(Object.keys(photosOf(e.tab()))).toHaveLength(2);
    // Asked once: set, the ask is gone.
    expect(photoEditSampleAsked('cloud-tab')).toBe(false);
  });

  it('in an Offline Mode design: kept in this browser, nothing sent, then set', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    offline.add('d-offline');
    const e = editor(landed('offline-tab'), 'd-offline');
    askForPhotoEditSample('offline-tab');
    expect(await applyAskedPhotoEditSample(e.tab(), e.deps)).toBe(true);
    expect(f).not.toHaveBeenCalled();
    expect((await offlineBlobsFor(Object.values(ids))).map((x) => x.id)).toEqual(
      Object.values(ids),
    );
    expect(e.order).toEqual(['enqueue', 'stored', 'set']);
    expect(Object.keys(photosOf(e.tab()))).toHaveLength(2);
  });

  it('touches no tab it was not asked for, nor an existing one', async () => {
    const quiet = editor(landed('never-asked'), 'd');
    expect(await applyAskedPhotoEditSample(quiet.tab(), quiet.deps)).toBe(false);
    expect(quiet.load).not.toHaveBeenCalled();
    // An existing tab with the same shape as the template but a started photo: asked or not, it stays.
    const pageId = pagesOf(landed('x'))[0]!.id;
    const started = {
      ...landed('started'),
      photos: {
        [pageId]: {
          width: 8,
          height: 8,
          layers: [
            {
              id: 'ly-00000001',
              name: 'Layer 1',
              layerKind: 'fill',
              fill: { kind: 'solid', colour: '#ffffff' },
            },
          ],
        },
      },
    } as Tab;
    const e = editor(started, 'd');
    askForPhotoEditSample('started');
    expect(await applyAskedPhotoEditSample(e.tab(), e.deps)).toBe(false);
    expect(e.tab()).toBe(started);
    expect(e.order).toEqual([]);
  });

  it('waits for a tab still loading, and leaves the photo unstarted when the sample cannot be had', async () => {
    const loading: Tab = { id: 'slow', name: 'Tab 1', elements: [] };
    const e = editor(loading, 'd');
    askForPhotoEditSample('slow');
    expect(await applyAskedPhotoEditSample(loading, e.deps)).toBe(false);
    expect(photoEditSampleAsked('slow')).toBe(true);
    const failing = editor(landed('slow'), 'd');
    failing.load.mockResolvedValueOnce(null as never);
    expect(await applyAskedPhotoEditSample(failing.tab(), failing.deps)).toBe(false);
    expect(failing.order).toEqual([]);
    expect(photoEditSampleAsked('slow')).toBe(false);
  });

  it('sets nothing when the photo was started while the files were stored', async () => {
    vi.stubGlobal('fetch', vi.fn());
    offline.add('d');
    const e = editor(landed('raced'), 'd');
    askForPhotoEditSample('raced');
    const pageId = pagesOf(e.tab())[0]!.id;
    const startedMeanwhile = {
      ...e.tab(),
      photos: {
        [pageId]: {
          width: 8,
          height: 8,
          layers: [
            {
              id: 'ly-00000002',
              name: 'Layer 1',
              layerKind: 'fill',
              fill: { kind: 'solid', colour: '#000000' },
            },
          ],
        },
      },
    } as Tab;
    const settled = e.deps.settled;
    e.deps.settled = async (tabId) => {
      await settled(tabId);
      e.deps.commit(tabId, () => startedMeanwhile);
    };
    expect(await applyAskedPhotoEditSample(e.tab(), e.deps)).toBe(false);
    expect(e.tab()).toBe(startedMeanwhile);
  });
});
