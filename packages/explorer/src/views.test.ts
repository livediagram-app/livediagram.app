import { describe, expect, it } from 'vitest';
import { APPS } from '@liveworkspace/index-client';
import { explorerPath, sameView, viewFromLocation, type ExplorerView } from './views';
import { kindWords, listWords, siteOf } from './words';

describe('views and their addresses', () => {
  const views: ExplorerView[] = [
    { kind: 'home' },
    { kind: 'all' },
    { kind: 'recent' },
    { kind: 'favourites' },
    { kind: 'shared' },
    { kind: 'trash' },
    { kind: 'inbox' },
    { kind: 'timeline' },
    { kind: 'search', q: 'q3 & plans' },
    { kind: 'folder', id: 'f1' },
    { kind: 'team', id: 'team-1' },
    { kind: 'team', id: 'team-1', folderId: 'f2' },
    { kind: 'invites' },
    { kind: 'gallery' },
    { kind: 'shape-libraries' },
    { kind: 'offline' },
    { kind: 'offline', q: 'edited:7d road' },
  ];
  it.each(views)('round-trips %o', (view) => {
    const path = explorerPath(view, '/explorer');
    const [pathname, search = ''] = path.split('?');
    expect(viewFromLocation(pathname!, search)).toEqual(view);
  });

  it('falls back to Home for an unknown address or a folder without an id', () => {
    expect(viewFromLocation('/explorer/activity-feed')).toEqual({ kind: 'home' });
    // Tags are gone; an old link lands on Home.
    expect(viewFromLocation('/explorer/tags', 'id=t1')).toEqual({ kind: 'home' });
    expect(viewFromLocation('/explorer/folder')).toEqual({ kind: 'home' });
    expect(viewFromLocation('/explorer')).toEqual({ kind: 'home' });
  });

  it('carries a list’s lens as q, and none on a view with no list', () => {
    const view = { kind: 'team', id: 'T1', folderId: 'f1', q: 'made-by:ai road' } as const;
    expect(explorerPath(view)).toBe('/explorer/team?id=T1&folder=f1&q=made-by%3Aai%20road');
    expect(viewFromLocation('/explorer/team', 'id=T1&folder=f1&q=made-by%3Aai%20road')).toEqual(
      view,
    );
    expect(viewFromLocation('/explorer/recent', 'q=%20%20')).toEqual({ kind: 'recent' });
    expect(viewFromLocation('/explorer/inbox', 'q=road')).toEqual({ kind: 'inbox' });
    // The old Generated view is Search results, made by AI.
    expect(viewFromLocation('/explorer/generated')).toEqual({ kind: 'search', q: 'made-by:ai' });
    // Unsorted is gone: its address is My Work, whose root lists what is in no folder.
    expect(viewFromLocation('/explorer/unsorted')).toEqual({ kind: 'all' });
    expect(viewFromLocation('/explorer/unsorted', 'q=road')).toEqual({ kind: 'all', q: 'road' });
    // The sidebar's highlight is the place, whatever the lens.
    expect(sameView({ kind: 'recent', q: 'edited:7d' }, { kind: 'recent' })).toBe(true);
  });

  it('keeps livediagram’s gallery address', () => {
    expect(explorerPath({ kind: 'gallery' })).toBe('/explorer/images');
    expect(viewFromLocation('/explorer/images')).toEqual({ kind: 'gallery' });
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
    expect(listWords('liveplanner', 'all').lowerMany).toBe('files');
  });

  it('has a site, with an accent, for every app', () => {
    for (const app of APPS) expect(siteOf(app).id).toBe(`${app}.app`);
  });
});
