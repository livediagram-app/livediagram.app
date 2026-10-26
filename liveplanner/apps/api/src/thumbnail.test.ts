import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PEN_INK, penColourHex } from '@liveplanner/project';
import { defaultCatalogue, presetSetup, type Item } from '@liveplanner/items';
import type { PlanEnv, ProjectDTO } from './types';

// A plan drawn for liveworkspace's previews (liveworkspace/docs/specs/006-media/previews.md): the platform stores and serves it, so
// these pin only the drawing. The tab body, cards, sheets and count stamp come through the db layer, mocked here;
// renderElementsToSvg stays real, it's pure.
const db = vi.hoisted(() => ({
  getTabBody: vi.fn(),
  getProjectItemTypes: vi.fn(),
  listItems: vi.fn(),
  listSheets: vi.fn(),
  dashboardSourceTabs: vi.fn(),
  stampTabElementCount: vi.fn(),
}));
vi.mock('./db', () => db);
vi.mock('./plan-room/plan-content', () => ({
  getPlanItemTypes: db.getProjectItemTypes,
}));

import { drawPlan } from './thumbnail';

const ENV = {} as unknown as PlanEnv;

function draw(
  doc: ProjectDTO,
  opts: { tabId?: string | null; defer?: (p: Promise<unknown>) => void } = {},
): Promise<string | null> {
  return drawPlan(ENV, doc, opts.tabId ?? null, opts.defer ? { defer: opts.defer } : {});
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

describe('drawPlan', () => {
  it('draws the first tab, or the one asked for', async () => {
    db.getTabBody.mockResolvedValue(stored(TAB_DATA));
    expect(await draw(liveDoc())).toContain('<svg');
    expect(db.getTabBody).toHaveBeenLastCalledWith(ENV, 'd1');
    await draw(liveDoc(), { tabId: 't2' });
    expect(db.getTabBody).toHaveBeenLastCalledWith(ENV, 'd1', 't2');
  });

  it('draws nothing for an empty project', async () => {
    db.getTabBody.mockResolvedValue(stored(JSON.stringify({ elements: [] }), 0));
    expect(await draw(liveDoc())).toBeNull();
  });

  // The lazy backfill of tabs.element_count: a tab whose count is still unknown gets it from this parse,
  // so an empty project is asked for at most once.
  it('records an unknown count from the body it parsed, empty or drawn', async () => {
    db.getTabBody.mockResolvedValue(stored(JSON.stringify({ elements: [] }), null));
    expect(await draw(liveDoc())).toBeNull();
    expect(db.stampTabElementCount).toHaveBeenCalledWith(ENV, 't1', 0);
    db.getTabBody.mockResolvedValue(stored(TAB_DATA, null));
    expect(await draw(liveDoc())).toContain('<svg');
    expect(db.stampTabElementCount).toHaveBeenLastCalledWith(ENV, 't1', 1);
  });

  // docs/specs/030-forms/forms.md: a Form tab's form is not an element, so its canvas is empty; the drawing is the
  // form as respondents see it, and its count takes the form in.
  it('draws a Form tab as its form, and counts the form', async () => {
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

    const out = await draw(liveDoc());

    expect(out).toContain('<svg');
    expect(out).toContain('Contact Us');
    expect(out).toContain('Your name');
    expect(db.stampTabElementCount).toHaveBeenCalledWith(ENV, 't1', 1);
    // A form that cannot be read leaves the tab as its canvas: empty, nothing drawn.
    db.getTabBody.mockResolvedValue(
      stored(JSON.stringify({ kind: 'form', elements: [], form: 'not a form' }), 0),
    );
    expect(await draw(liveDoc())).toBeNull();
  });

  // The Explorer route's one read leaves the card types out; a board draws only the types it takes, so the drawing
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
    db.getTabBody.mockResolvedValue(stored(JSON.stringify({ kind: 'board', elements: [board] })));
    db.listItems.mockResolvedValue([card]);
    db.getProjectItemTypes.mockResolvedValue(defaultCatalogue());

    const out = await draw(liveDoc());
    expect(db.getProjectItemTypes).toHaveBeenCalledWith(ENV, 'd1');
    expect(out).toContain('Ship the fix');
    // A caller that read them passes them: no second read.
    db.getProjectItemTypes.mockClear();
    await draw(liveDoc({ itemTypes: defaultCatalogue() }));
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
    db.getTabBody.mockResolvedValue({ ...stored(JSON.stringify(dashboard)), id: 'dash' });
    db.dashboardSourceTabs.mockResolvedValue([boardTab]);
    db.listItems.mockResolvedValue([card(1), card(2), card(3)]);
    db.listSheets.mockResolvedValue([]);

    const out = (await draw(liveDoc({ itemTypes: defaultCatalogue() })))!;
    // One query for the tabs it draws from: the slot's tab (and every board, for the status names).
    expect(db.dashboardSourceTabs).toHaveBeenCalledWith(ENV, 'd1', ['bt'], 60);
    // The metric's own picture: its name, its figure and its line.
    expect(out).toContain('>Item Count<');
    expect(out).toContain('>Across every board<');
    expect(out).not.toContain('>Metric<');
    expect(out).toContain('Card number 2');
  });

  // docs/specs/029-sheets/sheet.md "Exports and images": a named tab's picture is what a link confined to that tab
  // gets, so its card functions read only the cards the tab shows; the first tab's reads every card.
  it("counts only a named tab's own cards in its sheet formulas", async () => {
    const { book } = await import('../../../packages/sheets/src/testing/book');
    const { sheetToJson } = await import('../../../packages/sheets/src/sheet-json');
    const sheet = book({ A1: '=CARDCOUNT()+1000' }).sheets.map(sheetToJson);
    const card = (id: string, title: string) =>
      ({
        id,
        type: 'task',
        key: 1,
        rank: 'a',
        fields: { title, status: presetSetup('kanban').columns[0]!.status },
        rev: 1,
        createdAt: 0,
        updatedAt: 0,
        createdBy: { id: 'p', name: 'P', color: '#000000' },
        updatedBy: { id: 'p', name: 'P', color: '#000000' },
      }) as unknown as Item;
    const frame = {
      id: 's1',
      type: 'shape',
      shape: 'plan-sheet',
      x: 0,
      y: 0,
      width: 400,
      height: 200,
      planSheet: { sheetId: sheet[0]!.id },
    };
    const pinned = {
      id: 'c1',
      type: 'shape',
      shape: 'plan-card',
      x: 500,
      y: 0,
      width: 200,
      height: 100,
      planCard: { itemId: 'i1' },
    };
    db.getTabBody.mockResolvedValue(stored(JSON.stringify({ elements: [frame, pinned] }), 2));
    db.listSheets.mockResolvedValue(sheet);
    db.listItems.mockResolvedValue([
      card('i1', 'Shown'),
      card('i2', 'Elsewhere'),
      card('i3', 'Also'),
    ]);
    db.getProjectItemTypes.mockResolvedValue(defaultCatalogue());

    expect(await draw(liveDoc())).toContain('>1003<');
    const named = await draw(liveDoc(), { tabId: 't1' });
    expect(named).toContain('>1001<');
    expect(named).not.toContain('>1003<');
  });

  it('writes nothing for a count already known, or a body it cannot count', async () => {
    db.getTabBody.mockResolvedValue(stored(JSON.stringify({ elements: [] }), 0));
    await draw(liveDoc());
    db.getTabBody.mockResolvedValue(stored('not json', null));
    expect(await draw(liveDoc())).toBeNull();
    expect(db.stampTabElementCount).not.toHaveBeenCalled();
  });

  it('hands the count stamp to `defer`, and a failed stamp never fails the read', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    db.getTabBody.mockResolvedValue(stored(JSON.stringify({ elements: [] }), null));
    db.stampTabElementCount.mockRejectedValue(new Error('d1 busy'));
    const deferred: Promise<unknown>[] = [];
    expect(await draw(liveDoc(), { defer: (p) => deferred.push(p) })).toBeNull();
    expect(deferred).toHaveLength(1);
    await deferred[0];
    expect(warn).toHaveBeenCalledWith(
      '[thumbnail] count stamp failed',
      expect.objectContaining({ tabId: 't1' }),
    );
  });

  it('returns null when the project has no tabs', async () => {
    db.getTabBody.mockResolvedValue(null);

    expect(await draw(liveDoc())).toBeNull();
  });

  it('draws an image element as its placeholder', async () => {
    const tabData = JSON.stringify({
      elements: [{ id: 'e1', type: 'image', x: 0, y: 0, width: 100, height: 80, imageId: 'img-1' }],
    });
    db.getTabBody.mockResolvedValue(stored(tabData));

    const out = (await draw(liveDoc()))!;

    expect(out).not.toContain('<image');
  });
});

// Retired schemes (docs/specs/011-theme/retired-schemes.md): the thumbnail parses `tabs.data` itself,
// so it runs the same stored-tab migration as every other read.
describe('a thumbnail of named stock colours', () => {
  it('draws Blue and Ink by name in the light page version', async () => {
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
    const out = await draw(liveDoc());
    expect(out).toContain(penColourHex('blue', 'light'));
    expect(out).toContain(PEN_INK.light);
  });
});
