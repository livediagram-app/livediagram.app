import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PEN_INK, penColourHex } from '@liveplanner/project';
import { defaultCatalogue, presetSetup, type Item } from '@liveplanner/items';
import type { ProjectDTO, Env } from './types';

// The render-cache reads/writes the snapshot freshness + first-tab body
// through the db layer; mock it so the test pins the cache decision tree
// (fresh → stream R2, stale → render+put+stamp, empty → null) without a
// live D1. renderElementsToSvg stays real — it's pure.
const db = vi.hoisted(() => ({
  getTabBody: vi.fn(),
  getProjectItemTypes: vi.fn(),
  listItems: vi.fn(),
  listSheets: vi.fn(),
  dashboardSourceTabs: vi.fn(),
  stampTabElementCount: vi.fn(),
  getThumbRenderedAt: vi.fn(),
  markThumbRendered: vi.fn(),
  thumbnailKey: (id: string) => `thumb/${id}`,
}));
vi.mock('./db', () => db);

import { getProjectThumbnailSvg } from './thumbnail';

function r2() {
  return { get: vi.fn(), put: vi.fn().mockResolvedValue(undefined), delete: vi.fn() };
}

function liveDoc(over: Partial<ProjectDTO> = {}): ProjectDTO {
  return {
    id: 'd1',
    ownerId: 'o1',
    name: 'Project',
    tabs: [],
    shareable: false,
    shareCode: null,
    folderId: null,
    teamId: null,
    source: null,
    savedAt: 1000,
    createdAt: 0,
    ownerName: null,
    ownerColor: null,
    // No recorded creation intent (docs/specs/013-workspace/default-folders.md).
    opensIn: null,
    tabKind: null,
    templateFamily: null,
    ...over,
  };
}

// A one-shape first tab, in the on-disk `tabs.data` shape (body minus
// id + name — see db/tabs.ts upsertTab).
const TAB_DATA = JSON.stringify({
  elements: [{ id: 'e1', type: 'shape', shape: 'square', x: 0, y: 0, width: 100, height: 80 }],
});

// A first tab as getTabBody returns it; its count is known unless the test says otherwise.
const stored = (data: string, elementCount: number | null = 1) => ({
  id: 't1',
  data,
  elementCount,
});

beforeEach(() => {
  vi.clearAllMocks();
  db.stampTabElementCount.mockResolvedValue(undefined);
});

describe('getProjectThumbnailSvg', () => {
  it('returns null without an R2 binding (a deployment without storage)', async () => {
    const out = await getProjectThumbnailSvg({} as Env, liveDoc());
    expect(out).toBeNull();
    expect(db.getThumbRenderedAt).not.toHaveBeenCalled();
  });

  it('streams the cached object when fresh, without re-rendering', async () => {
    const images = r2();
    images.get.mockResolvedValue({ text: async () => '<svg>cached</svg>' });
    db.getThumbRenderedAt.mockResolvedValue(2000); // >= savedAt 1000 → fresh
    const env = { SNAPSHOTS: images } as unknown as Env;

    const out = await getProjectThumbnailSvg(env, liveDoc());

    expect(out).toBe('<svg>cached</svg>');
    expect(db.getTabBody).not.toHaveBeenCalled();
    expect(images.put).not.toHaveBeenCalled();
    expect(db.markThumbRendered).not.toHaveBeenCalled();
  });

  it('renders, caches, and stamps fresh when stale', async () => {
    const images = r2();
    images.get.mockResolvedValue(null);
    db.getThumbRenderedAt.mockResolvedValue(null); // never rendered → stale
    db.getTabBody.mockResolvedValue(stored(TAB_DATA));
    const env = { SNAPSHOTS: images } as unknown as Env;

    const out = await getProjectThumbnailSvg(env, liveDoc());

    expect(out).toContain('<svg');
    expect(images.put).toHaveBeenCalledOnce();
    expect(images.put.mock.calls[0]![0]).toBe('thumb/d1');
    expect(db.markThumbRendered).toHaveBeenCalledWith(env, 'd1', expect.any(Number));
  });

  it('trusts a freshness stamp the caller already read, saving the query', async () => {
    const images = r2();
    images.get.mockResolvedValue({ text: async () => '<svg>cached</svg>' });
    const env = { SNAPSHOTS: images } as unknown as Env;

    const out = await getProjectThumbnailSvg(env, { ...liveDoc(), thumbRenderedAt: 2000 });

    expect(out).toBe('<svg>cached</svg>');
    expect(db.getThumbRenderedAt).not.toHaveBeenCalled();
  });

  it('hands the cache write to `defer` instead of awaiting it', async () => {
    const images = r2();
    let finishPut!: () => void;
    images.put.mockReturnValue(new Promise<void>((resolve) => (finishPut = resolve)));
    db.getTabBody.mockResolvedValue(stored(TAB_DATA));
    const env = { SNAPSHOTS: images } as unknown as Env;
    const deferred: Promise<unknown>[] = [];

    // Resolves while the put is still pending: the response is not held
    // behind the R2 write + D1 stamp.
    const out = await getProjectThumbnailSvg(
      env,
      { ...liveDoc(), thumbRenderedAt: null },
      { defer: (p) => deferred.push(p) },
    );
    expect(out).toContain('<svg');
    expect(deferred).toHaveLength(1);
    expect(db.markThumbRendered).not.toHaveBeenCalled();

    finishPut();
    await deferred[0];
    expect(db.markThumbRendered).toHaveBeenCalledWith(env, 'd1', expect.any(Number));
  });

  it('re-renders when the freshness stamp is set but the object is gone', async () => {
    const images = r2();
    images.get.mockResolvedValue(null); // evicted despite a fresh stamp
    db.getThumbRenderedAt.mockResolvedValue(5000);
    db.getTabBody.mockResolvedValue(stored(TAB_DATA));
    const env = { SNAPSHOTS: images } as unknown as Env;

    const out = await getProjectThumbnailSvg(env, liveDoc());

    expect(out).toContain('<svg');
    expect(images.put).toHaveBeenCalledOnce();
  });

  it('returns null for an empty project and never caches it', async () => {
    const images = r2();
    db.getThumbRenderedAt.mockResolvedValue(null);
    db.getTabBody.mockResolvedValue(stored(JSON.stringify({ elements: [] }), 0));
    const env = { SNAPSHOTS: images } as unknown as Env;

    const out = await getProjectThumbnailSvg(env, liveDoc());

    expect(out).toBeNull();
    expect(images.put).not.toHaveBeenCalled();
    expect(db.markThumbRendered).not.toHaveBeenCalled();
  });

  // The lazy backfill of tabs.element_count: a tab whose count is still unknown gets it from this parse,
  // so an empty project is asked for at most once.
  it('records an unknown count from the body it parsed, empty or drawn', async () => {
    const env = { SNAPSHOTS: r2() } as unknown as Env;
    db.getThumbRenderedAt.mockResolvedValue(null);
    db.getTabBody.mockResolvedValue(stored(JSON.stringify({ elements: [] }), null));
    expect(await getProjectThumbnailSvg(env, liveDoc())).toBeNull();
    expect(db.stampTabElementCount).toHaveBeenCalledWith(env, 't1', 0);
    db.getTabBody.mockResolvedValue(stored(TAB_DATA, null));
    expect(await getProjectThumbnailSvg(env, liveDoc())).toContain('<svg');
    expect(db.stampTabElementCount).toHaveBeenLastCalledWith(env, 't1', 1);
  });

  // docs/specs/030-forms/forms.md: a Form tab's form is not an element, so its canvas is empty; the snapshot is the
  // form as respondents see it, and its count takes the form in.
  it('draws a Form tab as its form, and counts the form', async () => {
    const images = r2();
    db.getThumbRenderedAt.mockResolvedValue(null);
    const form = {
      v: 1,
      heading: 'Contact Us',
      sections: [
        { id: 's1', title: '', questions: [{ id: 'q1', type: 'short', prompt: 'Your name' }] },
      ],
    };
    db.getTabBody.mockResolvedValue(
      stored(JSON.stringify({ kind: 'form', theme: 'forest', elements: [], form }), null),
    );
    const env = { SNAPSHOTS: images } as unknown as Env;

    const out = await getProjectThumbnailSvg(env, liveDoc());

    expect(out).toContain('<svg');
    expect(out).toContain('Contact Us');
    expect(out).toContain('Your name');
    expect(images.put).toHaveBeenCalledOnce();
    expect(db.stampTabElementCount).toHaveBeenCalledWith(env, 't1', 1);
    // A form that cannot be read leaves the tab as its canvas: empty, nothing drawn.
    db.getTabBody.mockResolvedValue(
      stored(JSON.stringify({ kind: 'form', elements: [], form: 'not a form' }), 0),
    );
    expect(await getProjectThumbnailSvg(env, liveDoc())).toBeNull();
  });

  // The Explorer route's one read leaves the card types out; a board draws only the types it takes, so the snapshot
  // reads them before drawing its cards (it drew an empty board before).
  it('draws a board’s cards, reading the card types the route left out', async () => {
    const board = {
      id: 'b1',
      type: 'shape',
      shape: 'plan-board',
      x: 0,
      y: 0,
      width: 1400,
      height: 720,
      planBoard: presetSetup('kanban'),
    };
    const status = presetSetup('kanban').columns[0]!.status;
    const card = {
      id: 'i1',
      type: 'task',
      key: 1,
      rank: 'a',
      fields: { title: 'Ship the fix', status },
      rev: 1,
      createdAt: 0,
      updatedAt: 0,
      createdBy: { id: 'p', name: 'P', color: '#000000' },
      updatedBy: { id: 'p', name: 'P', color: '#000000' },
    } as unknown as Item;
    db.getThumbRenderedAt.mockResolvedValue(null);
    db.getTabBody.mockResolvedValue(stored(JSON.stringify({ kind: 'board', elements: [board] })));
    db.listItems.mockResolvedValue([card]);
    db.getProjectItemTypes.mockResolvedValue(defaultCatalogue());
    const env = { SNAPSHOTS: r2() } as unknown as Env;

    const out = await getProjectThumbnailSvg(env, liveDoc());
    expect(db.getProjectItemTypes).toHaveBeenCalledWith(env, 'd1');
    expect(out).toContain('Ship the fix');
    // A caller that read them passes them: no second read.
    db.getProjectItemTypes.mockClear();
    await getProjectThumbnailSvg(env, liveDoc({ itemTypes: defaultCatalogue() }));
    expect(db.getProjectItemTypes).not.toHaveBeenCalled();
  });

  // docs/specs/013-workspace/live-image-share.md "What each tab draws": a Dashboard is its page, each metric drawn
  // from the cards, never a box labelled Metric; a slot's Board tab draws that tab's board and its cards.
  it('draws a Dashboard’s metrics from the cards and its tab slots’ boards', async () => {
    const view = {
      id: 'v1',
      type: 'shape',
      shape: 'plan-view',
      x: 0,
      y: 0,
      width: 300,
      height: 160,
      planView: { view: 'metric:count' },
    };
    const boardTab = {
      id: 'bt',
      name: 'Sprint',
      kind: 'board',
      elements: [
        {
          id: 'b1',
          type: 'shape',
          shape: 'plan-board',
          x: 0,
          y: 0,
          width: 1400,
          height: 720,
          planBoard: presetSetup('kanban'),
        },
      ],
    };
    const status = presetSetup('kanban').columns[0]!.status;
    const card = (n: number) =>
      ({
        id: `i${n}`,
        type: 'task',
        key: n,
        rank: `a${n}`,
        fields: { title: `Card number ${n}`, status },
        rev: 1,
        createdAt: 0,
        updatedAt: n,
        createdBy: { id: 'p', name: 'P', color: '#000000' },
        updatedBy: { id: 'p', name: 'P', color: '#000000' },
      }) as unknown as Item;
    const dashboard = {
      kind: 'dashboard',
      elements: [view],
      dashboard: {
        rows: [
          {
            id: 'r1',
            height: 320,
            slots: [
              { id: 's1', span: 4, content: { type: 'element', elementId: 'v1' } },
              { id: 's2', span: 8, content: { type: 'tab', tabId: 'bt', of: 'board' } },
            ],
          },
        ],
      },
    };
    db.getThumbRenderedAt.mockResolvedValue(null);
    db.getTabBody.mockResolvedValue({ ...stored(JSON.stringify(dashboard)), id: 'dash' });
    db.dashboardSourceTabs.mockResolvedValue([boardTab]);
    db.listItems.mockResolvedValue([card(1), card(2), card(3)]);
    db.listSheets.mockResolvedValue([]);
    const env = { SNAPSHOTS: r2() } as unknown as Env;

    const out = (await getProjectThumbnailSvg(env, liveDoc({ itemTypes: defaultCatalogue() })))!;
    // One query for the tabs it draws from: the slot's tab (and every board, for the status names).
    expect(db.dashboardSourceTabs).toHaveBeenCalledWith(env, 'd1', ['bt'], 60);
    // The metric's own picture: its name, its figure and its line.
    expect(out).toContain('>Item Count<');
    expect(out).toContain('>Across every board<');
    expect(out).not.toContain('>Metric<');
    expect(out).toContain('Card number 2');
  });

  it('writes nothing for a count already known, or a body it cannot count', async () => {
    const env = { SNAPSHOTS: r2() } as unknown as Env;
    db.getThumbRenderedAt.mockResolvedValue(null);
    db.getTabBody.mockResolvedValue(stored(JSON.stringify({ elements: [] }), 0));
    await getProjectThumbnailSvg(env, liveDoc());
    db.getTabBody.mockResolvedValue(stored('not json', null));
    expect(await getProjectThumbnailSvg(env, liveDoc())).toBeNull();
    expect(db.stampTabElementCount).not.toHaveBeenCalled();
  });

  it('hands the count stamp to `defer`, and a failed stamp never fails the read', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const env = { SNAPSHOTS: r2() } as unknown as Env;
    db.getThumbRenderedAt.mockResolvedValue(null);
    db.getTabBody.mockResolvedValue(stored(JSON.stringify({ elements: [] }), null));
    db.stampTabElementCount.mockRejectedValue(new Error('d1 busy'));
    const deferred: Promise<unknown>[] = [];
    expect(
      await getProjectThumbnailSvg(env, liveDoc(), { defer: (p) => deferred.push(p) }),
    ).toBeNull();
    expect(deferred).toHaveLength(1);
    await deferred[0];
    expect(warn).toHaveBeenCalledWith(
      '[thumbnail] count stamp failed',
      expect.objectContaining({ tabId: 't1' }),
    );
  });

  it('returns null when the project has no tabs', async () => {
    const images = r2();
    db.getThumbRenderedAt.mockResolvedValue(null);
    db.getTabBody.mockResolvedValue(null);
    const env = { SNAPSHOTS: images } as unknown as Env;

    expect(await getProjectThumbnailSvg(env, liveDoc())).toBeNull();
    expect(images.put).not.toHaveBeenCalled();
  });

  it('draws an image element as its placeholder, reading nothing but the snapshot from R2', async () => {
    const images = r2();
    const tabData = JSON.stringify({
      elements: [{ id: 'e1', type: 'image', x: 0, y: 0, width: 100, height: 80, imageId: 'img-1' }],
    });
    db.getThumbRenderedAt.mockResolvedValue(null); // stale → render
    db.getTabBody.mockResolvedValue(stored(tabData));
    images.get.mockResolvedValue(null);
    const env = { SNAPSHOTS: images } as unknown as Env;

    const out = (await getProjectThumbnailSvg(env, liveDoc()))!;

    expect(out).not.toContain('<image');
    expect(images.get).not.toHaveBeenCalled();
  });

  it('still returns the SVG when the R2 write fails (no stamp)', async () => {
    const images = r2();
    images.get.mockResolvedValue(null);
    images.put.mockRejectedValue(new Error('r2 down'));
    db.getThumbRenderedAt.mockResolvedValue(null);
    db.getTabBody.mockResolvedValue(stored(TAB_DATA));
    const env = { SNAPSHOTS: images } as unknown as Env;

    const out = await getProjectThumbnailSvg(env, liveDoc());

    expect(out).toContain('<svg');
    expect(db.markThumbRendered).not.toHaveBeenCalled();
  });
});

// Retired schemes (docs/specs/011-theme/retired-schemes.md): the thumbnail parses `tabs.data` itself,
// so it runs the same stored-tab migration as every other read.
describe('a thumbnail of a Charcoal tab', () => {
  it('renders the migrated tab, not the colours Charcoal baked', async () => {
    vi.spyOn(console, 'info').mockImplementation(() => {});
    const images = r2();
    images.get.mockResolvedValue(null);
    db.getThumbRenderedAt.mockResolvedValue(null);
    db.getTabBody.mockResolvedValue(
      stored(
        JSON.stringify({
          theme: 'charcoal',
          backgroundColor: '#2b2b33',
          patternColor: '#636373',
          elements: [
            {
              id: 'e1',
              type: 'shape',
              shape: 'square',
              x: 0,
              y: 0,
              width: 100,
              height: 80,
              fillColor: '#2c2c33',
            },
          ],
        }),
      ),
    );
    const out = await getProjectThumbnailSvg({ SNAPSHOTS: images } as unknown as Env, liveDoc());
    expect(out).not.toContain('#2c2c33');
    expect(out).toContain('#0d121a');
  });
});

// Stock colours are first-class (docs/specs/007-editor/editor-modes.md "One look"): a thumbnail
// draws a colour stored by name in its version for the page, on any tab, whatever mode drew it.
describe('a thumbnail of named stock colours', () => {
  it('draws Blue and Ink by name in the light page version', async () => {
    const images = r2();
    images.get.mockResolvedValue(null);
    db.getThumbRenderedAt.mockResolvedValue(null);
    const shape = { type: 'shape', shape: 'square', x: 0, y: 0, width: 100, height: 80 };
    db.getTabBody.mockResolvedValue(
      stored(
        JSON.stringify({
          elements: [
            { ...shape, id: 'e1', penColour: 'blue' },
            { ...shape, id: 'e2', x: 200, penColour: 'ink' },
          ],
        }),
        2,
      ),
    );
    const out = await getProjectThumbnailSvg({ SNAPSHOTS: images } as unknown as Env, liveDoc());
    expect(out).toContain(penColourHex('blue', 'light'));
    expect(out).toContain(PEN_INK.light);
  });
});
