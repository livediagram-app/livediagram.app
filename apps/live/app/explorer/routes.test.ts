import { describe, expect, it } from 'vitest';
import { explorerPathFor, selectedFromRoute } from './routes';
import type { SelectedNode } from './views';

// The mapping is the explorer's URL contract (spec/15): every sidebar
// section must round-trip node → path → node, because the sidebar
// highlights whatever selectedFromRoute derives from the address bar.

const STATIC_NODES: SelectedNode[] = [
  { kind: 'timeline' },
  { kind: 'recent' },
  { kind: 'favourites' },
  { kind: 'themes' },
  { kind: 'tokens' },
  { kind: 'all' },
  { kind: 'unsorted' },
  { kind: 'generated' },
  { kind: 'offline' },
  { kind: 'dynamic' },
  { kind: 'shared' },
  { kind: 'gallery' },
  { kind: 'invites' },
  { kind: 'profile' },
];

describe('explorer route mapping', () => {
  it('round-trips every static section', () => {
    for (const node of STATIC_NODES) {
      const path = explorerPathFor(node);
      expect(selectedFromRoute(path, new URLSearchParams())).toEqual(node);
    }
  });

  it('round-trips folder and team ids through the query string', () => {
    for (const kind of ['folder', 'team'] as const) {
      const node = { kind, id: 'abc-123' };
      const url = new URL(explorerPathFor(node), 'https://x.test');
      expect(selectedFromRoute(url.pathname, url.searchParams)).toEqual(node);
    }
  });

  it('URL-encodes ids', () => {
    expect(explorerPathFor({ kind: 'folder', id: 'a/b c' })).toBe('/explorer/folder?id=a%2Fb%20c');
  });

  it('tolerates the static-export trailing slash', () => {
    expect(selectedFromRoute('/explorer/images/', new URLSearchParams())).toEqual({
      kind: 'gallery',
    });
  });

  // The landing section (spec/138 §8.1). Three places decide it — the
  // live worker's 302, the /explorer client replace, and this default —
  // and they have to agree, or a mangled link lands somewhere the
  // address bar doesn't.
  it('falls back to timeline for /explorer, id-less folder/team URLs, and junk', () => {
    expect(selectedFromRoute('/explorer', new URLSearchParams())).toEqual({ kind: 'timeline' });
    expect(selectedFromRoute('/explorer/folder', new URLSearchParams())).toEqual({
      kind: 'timeline',
    });
    expect(selectedFromRoute('/explorer/team', new URLSearchParams())).toEqual({
      kind: 'timeline',
    });
    expect(selectedFromRoute('/explorer/nope', new URLSearchParams())).toEqual({
      kind: 'timeline',
    });
  });
});
