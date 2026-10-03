import { describe, expect, it } from 'vitest';
import { explorerPathFor, selectedFromRoute } from './routes';
import type { SelectedNode } from './views';
import { EXPLORER_LANDING_PATH } from '@/lib/explorer-landing';

// The mapping is the explorer's URL contract (docs/specs/013-workspace/folders.md): every sidebar
// section must round-trip node → path → node, because the sidebar
// highlights whatever selectedFromRoute derives from the address bar.

const STATIC_NODES: SelectedNode[] = [
  { kind: 'home' },
  { kind: 'timeline' },
  { kind: 'activity' },
  { kind: 'recent' },
  { kind: 'favourites' },
  { kind: 'themes' },
  { kind: 'shape-libraries' },
  { kind: 'all' },
  { kind: 'search' },
  { kind: 'offline' },
  { kind: 'shared' },
  { kind: 'gallery' },
  { kind: 'invites' },
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

  // The retired buckets (docs/specs/013-workspace/folders.md#the-root-and-the-retired-buckets) read as
  // the views their pages replace themselves with, so the sidebar highlights the right row at once.
  it('reads the retired Unsorted, Dynamic and Generated addresses as their successors', () => {
    expect(selectedFromRoute('/explorer/unsorted', new URLSearchParams())).toEqual({ kind: 'all' });
    expect(selectedFromRoute('/explorer/dynamic/', new URLSearchParams())).toEqual({ kind: 'all' });
    expect(selectedFromRoute('/explorer/generated', new URLSearchParams())).toEqual({
      kind: 'search',
    });
  });

  it('URL-encodes ids', () => {
    expect(explorerPathFor({ kind: 'folder', id: 'a/b c' })).toBe('/explorer/folder?id=a%2Fb%20c');
  });

  it('tolerates the static-export trailing slash', () => {
    expect(selectedFromRoute('/explorer/images/', new URLSearchParams())).toEqual({
      kind: 'gallery',
    });
  });

  it('keeps All activity, the Timeline feed, on its route', () => {
    expect(explorerPathFor({ kind: 'timeline' })).toBe('/explorer/timeline');
    expect(explorerPathFor({ kind: 'home' })).toBe('/explorer/home');
  });

  // The landing section is Home (docs/specs/013-workspace/timeline.md §8.1). Three places decide
  // it (the live worker's 302, the /explorer client replace, and this default) and they have to
  // agree, or a mangled link lands somewhere the address bar doesn't.
  it('falls back to home for /explorer, id-less folder/team URLs, and junk', () => {
    expect(selectedFromRoute('/explorer', new URLSearchParams())).toEqual({ kind: 'home' });
    expect(explorerPathFor({ kind: 'home' })).toBe(EXPLORER_LANDING_PATH);
    expect(selectedFromRoute('/explorer/folder', new URLSearchParams())).toEqual({
      kind: 'home',
    });
    expect(selectedFromRoute('/explorer/team', new URLSearchParams())).toEqual({
      kind: 'home',
    });
    expect(selectedFromRoute('/explorer/nope', new URLSearchParams())).toEqual({
      kind: 'home',
    });
  });
});
