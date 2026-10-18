import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Tab } from '@livediagram/document';

// docs/specs/019-marketing/returning-visitor.md: the preview of a document in This Browser is drawn in the browser from
// its first tab in the offline store, by the shared renderer; an empty or missing first tab has none.
const store = vi.hoisted(() => ({ doc: null as unknown, tab: null as Tab | null }));
vi.mock('@/lib/offline/offline-store', () => ({
  offlineLoadDocument: vi.fn(async () => store.doc),
  offlineLoadTab: vi.fn(async () => store.tab),
}));
vi.mock('@/lib/icon-registry', () => ({
  ensureIconCatalogs: vi.fn(async () => undefined),
  resolveIconArtLoaded: () => undefined,
  resolveStickerArtLoaded: () => undefined,
}));

import { localSnapshotSvg } from './local-snapshot';

const tab = (elements: Tab['elements']): Tab => ({ id: 't1', name: 'Tab', elements });

describe('localSnapshotSvg', () => {
  beforeEach(() => {
    store.doc = { id: 'd1', tabs: [{ id: 't1' }] };
    store.tab = null;
  });

  it('draws the first tab as an SVG', async () => {
    store.tab = tab([
      {
        id: 'a',
        type: 'shape',
        shape: 'rectangle',
        x: 0,
        y: 0,
        width: 120,
        height: 60,
        text: 'Hi',
      },
    ] as unknown as Tab['elements']);
    const svg = await localSnapshotSvg('d1');
    expect(svg).toMatch(/^<svg[\s\S]*<\/svg>$/);
  });

  it('has no picture for an empty first tab, a tabless document, or none at all', async () => {
    store.tab = tab([]);
    expect(await localSnapshotSvg('d1')).toBeNull();
    store.doc = { id: 'd1', tabs: [] };
    expect(await localSnapshotSvg('d1')).toBeNull();
    store.doc = null;
    expect(await localSnapshotSvg('d1')).toBeNull();
  });
});
