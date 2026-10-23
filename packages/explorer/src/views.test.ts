import { describe, expect, it } from 'vitest';
import { APPS } from '@liveworkspace/index-client';
import { explorerPath, viewFromLocation, type ExplorerView } from './views';
import { kindWords, listWords, siteOf } from './words';

describe('views and their addresses', () => {
  const views: ExplorerView[] = [
    { kind: 'home' },
    { kind: 'all' },
    { kind: 'unsorted' },
    { kind: 'recent' },
    { kind: 'favourites' },
    { kind: 'shared' },
    { kind: 'trash' },
    { kind: 'inbox' },
    { kind: 'search', q: 'q3 & plans' },
    { kind: 'folder', id: 'f1' },
    { kind: 'team', id: 'team-1' },
    { kind: 'team', id: 'team-1', folderId: 'f2' },
  ];
  it.each(views)('round-trips %o', (view) => {
    const path = explorerPath(view, '/explorer');
    const [pathname, search = ''] = path.split('?');
    expect(viewFromLocation(pathname!, search)).toEqual(view);
  });

  it('falls back to Home for an unknown address or a folder without an id', () => {
    expect(viewFromLocation('/explorer/timeline')).toEqual({ kind: 'home' });
    // Tags are gone; an old link lands on Home.
    expect(viewFromLocation('/explorer/tags', 'id=t1')).toEqual({ kind: 'home' });
    expect(viewFromLocation('/explorer/folder')).toEqual({ kind: 'home' });
    expect(viewFromLocation('/explorer')).toEqual({ kind: 'home' });
  });

  it('honours a host base path', () => {
    expect(explorerPath({ kind: 'trash' }, '/app/explorer/')).toBe('/app/explorer/trash');
    expect(viewFromLocation('/app/explorer/trash', '', '/app/explorer')).toEqual({ kind: 'trash' });
  });
});

describe('words', () => {
  it('names each app’s kind, and says item while every app shows', () => {
    expect(APPS.map((a) => kindWords(a).one)).toEqual(['Canvas', 'Plan', 'Document', 'Design']);
    expect(kindWords('livediagram').many).toBe('Canvases');
    expect(listWords('liveplanner', 'all').lowerMany).toBe('items');
  });

  it('has a site, with an accent, for every app', () => {
    for (const app of APPS) expect(siteOf(app).id).toBe(`${app}.app`);
  });
});
