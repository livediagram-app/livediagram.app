import { describe, expect, it } from 'vitest';
import type { MigrationRoomPayload } from './contract';
import {
  boardTab,
  diagramTab,
  doc,
  hooks,
  NEW_OWNER,
  OWNER,
  plan,
  shape,
  slideTab,
} from './split-fixtures';
import { oldItemPersonId, plannerItemPersonId } from './person-ids';
import { hasRetiredContent, splitLocalDocument, splitOldDocument } from './split';

type Rec = Record<string, unknown>;
const body = (p: MigrationRoomPayload, tabId: string): Rec =>
  JSON.parse(p.tabs.find((t) => t.id === tabId)!.data) as Rec;
const part = (parts: MigrationRoomPayload[], app: string) => parts.find((p) => p.app === app)!;
const els = (b: Rec) => b.elements as Rec[];

describe('splitOldDocument: whole tabs', () => {
  it('keeps a diagram-only document whole under its id, every tab upgraded', () => {
    const r = splitOldDocument(doc([{ id: 't1', body: diagramTab() }]), hooks());
    expect(r.moved).toBeNull();
    expect(r.parts).toHaveLength(1);
    const [p] = r.parts;
    expect(p).toMatchObject({
      app: 'livediagram',
      id: 'doc1',
      ownerId: NEW_OWNER,
      teamId: 'team1',
      name: 'Roadmap',
    });
    expect(p!.tabs[0]).toMatchObject({
      id: 't1',
      orderIndex: 0,
      addedAt: 1100,
      updatedAt: 1500,
      elementCount: 1,
    });
    expect(body(p!, 't1').upgraded).toBe(true);
  });

  it('gives each app one part, livediagram keeping the id, the rest fresh ids with the same name and owner', () => {
    const r = splitOldDocument(
      doc([
        { id: 'd1', body: diagramTab() },
        { id: 's1', body: slideTab() },
        { id: 's2', body: slideTab() },
        { id: 'b1', body: boardTab() },
        { id: 'l1', body: { opensIn: 'pages', pages: [{ id: 'p1', kind: 'logo' }], elements: [] } },
      ]),
      hooks(),
    );
    expect(r.parts.map((p) => [p.app, p.id])).toEqual([
      ['livediagram', 'doc1'],
      ['liveplanner', 'new:doc1:liveplanner'],
      ['livedocuments', 'new:doc1:livedocuments'],
      ['livedesign', 'new:doc1:livedesign'],
    ]);
    for (const p of r.parts) {
      expect(p).toMatchObject({
        name: 'Roadmap',
        ownerId: NEW_OWNER,
        teamId: 'team1',
        createdAt: 1000,
        savedAt: 2000,
      });
    }
    expect(part(r.parts, 'livedocuments').tabs.map((t) => t.id)).toEqual(['s1', 's2']);
    expect(part(r.parts, 'liveplanner').plan).not.toBeNull();
    expect(part(r.parts, 'livediagram').plan).toBeNull();
    expect(r.moved).toEqual({
      oldId: 'doc1',
      keptBy: 'livediagram',
      parts: [
        { app: 'livediagram', id: 'doc1', tabIds: ['d1'] },
        { app: 'liveplanner', id: 'new:doc1:liveplanner', tabIds: ['b1'] },
        { app: 'livedocuments', id: 'new:doc1:livedocuments', tabIds: ['s1', 's2'] },
        { app: 'livedesign', id: 'new:doc1:livedesign', tabIds: ['l1'] },
      ],
    });
  });

  it('with no diagram tabs, the app with most tabs keeps the id', () => {
    const r = splitOldDocument(
      doc([
        { id: 's1', body: slideTab() },
        { id: 's2', body: slideTab() },
        { id: 'b1', body: boardTab() },
      ]),
      hooks(),
    );
    expect(r.parts.map((p) => [p.app, p.id])).toEqual([
      ['livedocuments', 'doc1'],
      ['liveplanner', 'new:doc1:liveplanner'],
    ]);
    expect(r.moved?.keptBy).toBe('livedocuments');
  });

  it('a single-app document that is not livediagram keeps its id there with no moved mapping', () => {
    const r = splitOldDocument(doc([{ id: 's1', body: slideTab() }]), hooks());
    expect(r.parts.map((p) => [p.app, p.id])).toEqual([['livedocuments', 'doc1']]);
    expect(r.moved).toBeNull();
  });

  it('reads the legacy Pages modes, an absent page kind and a stray Plan mode as their apps', () => {
    const r = splitOldDocument(
      doc([
        { id: 'a', body: { opensIn: 'illustrate', pageOrientation: 'landscape', elements: [] } },
        { id: 'b', body: { opensIn: 'infographic', pages: [{ id: 'p1' }], elements: [] } },
        { id: 'c', body: { kind: 'sheet', elements: [] } },
        { id: 'd', body: { kind: 'event-storming', opensIn: 'pages', elements: [] } },
        { id: 'e', body: { opensIn: 'facilitate', elements: [] } },
      ]),
      hooks(),
    );
    expect(r.moved!.parts.map((p) => [p.app, p.tabIds])).toEqual([
      ['livediagram', ['d', 'e']],
      ['liveplanner', ['c']],
      ['livedocuments', ['a', 'b']],
    ]);
    // A Pages tab is written in livedocuments' one mode.
    expect(body(part(r.parts, 'livedocuments'), 'a').opensIn).toBe('pages');
  });

  it("drops what livediagram doesn't read from a Diagram tab, with notes", () => {
    const r = splitOldDocument(
      doc([
        {
          id: 'd1',
          body: {
            pages: [{ id: 'p1', kind: 'slide' }],
            articles: {},
            dashboard: { rows: [] },
            elements: [
              {
                id: 'n1',
                type: 'annotation',
                x: 0,
                y: 0,
                width: 10,
                height: 10,
                articleNote: 'comment',
              },
            ],
          },
        },
      ]),
      hooks(),
    );
    const b = body(r.parts[0]!, 'd1');
    expect(b.pages).toBeUndefined();
    expect(b.articles).toBeUndefined();
    expect(b.dashboard).toBeUndefined();
    expect(b.elements).toEqual([]);
    expect(r.notes.join('\n')).toMatch(/1 page\(s\).*dropped/);
    expect(r.notes.join('\n')).toMatch(/margin note dropped/);
  });

  it('sends changesets with their tab and the slide deck to livediagram', () => {
    const cs = (id: string, tabId: string) => ({
      id,
      tabId,
      rev: 1,
      baseRev: 0,
      authorId: null,
      authorName: null,
      authorColor: null,
      tokenId: null,
      summary: null,
      fingerprints: null,
      added: 1,
      changed: 0,
      removed: 0,
      createdTab: 0,
      revertOf: null,
      createdAt: 5,
      parts: [],
    });
    const input = doc(
      [
        { id: 'd1', body: diagramTab() },
        { id: 's1', body: slideTab() },
      ],
      { changesets: [cs('c1', 'd1'), cs('c2', 's1'), cs('c3', 'gone')] },
    );
    input.document.presentation = '{"slides":[]}';
    const r = splitOldDocument(input, hooks());
    expect(part(r.parts, 'livediagram').changesets.map((c) => c.id)).toEqual(['c1', 'c3']);
    expect(part(r.parts, 'livedocuments').changesets.map((c) => c.id)).toEqual(['c2']);
    expect(part(r.parts, 'livediagram').presentation).toBe('{"slides":[]}');
    expect(part(r.parts, 'livedocuments').presentation).toBeNull();
    expect(r.notes.some((n) => n.includes('c3'))).toBe(true);
  });

  it('passes an unparseable body through to livediagram as stored, with a note', () => {
    const input = doc([{ id: 't1', body: {} }]);
    input.tabs[0]!.data = '{not json';
    const r = splitOldDocument(input, hooks());
    expect(r.parts[0]!.tabs[0]!.data).toBe('{not json');
    expect(r.notes[0]).toMatch(/not JSON/);
  });
});

describe('splitOldDocument: a Pages tab with both kinds of page', () => {
  // An infographic (A4, x 0..794), a logo (x 874..1386) and a slide (x 1466..2746), all from y 0.
  const mixed = () =>
    doc([
      {
        id: 'pg',
        body: {
          opensIn: 'pages',
          pages: [
            { id: 'p-info', kind: 'infographic', rowAt: { x: 0, y: 0 } },
            { id: 'p-logo', kind: 'logo', background: { fill: { imageId: 'img-bg' } } },
            { id: 'p-art', kind: 'article', flow: 'f1' },
          ],
          articles: { f1: { blocks: [] }, orphan: { blocks: [] } },
          elements: [
            shape('on-info', 100, 100),
            shape('on-logo', 900, 100),
            shape('on-art', 1500, 100),
            shape('nowhere', 100, 5000),
            {
              id: 'pic',
              type: 'image',
              x: 950,
              y: 150,
              width: 50,
              height: 50,
              imageId: 'img-logo',
            },
            {
              id: 'arrow',
              type: 'arrow',
              from: { kind: 'pinned', elementId: 'on-logo', anchor: 'right' },
              to: { kind: 'free', x: 1300, y: 300 },
            },
          ],
        },
      },
      {
        id: 'd1',
        body: diagramTab([
          shape('linker', 0, 0, { link: { kind: 'element', tabId: 'pg', elementId: 'on-logo' } }),
          shape('linker2', 0, 0, { link: { kind: 'element', tabId: 'pg', elementId: 'on-info' } }),
        ]),
      },
    ]);

  it('splits pages, elements and articles by page; the half with more pages keeps the tab id', () => {
    const r = splitOldDocument(mixed(), hooks());
    const docs = part(r.parts, 'livedocuments');
    const design = part(r.parts, 'livedesign');
    expect(docs.tabs.map((t) => t.id)).toEqual(['pg']);
    expect(design.tabs.map((t) => t.id)).toEqual(['new:doc1:pg:livedesign']);
    const d = body(docs, 'pg');
    const g = body(design, 'new:doc1:pg:livedesign');
    expect((d.pages as Rec[]).map((p) => p.id)).toEqual(['p-info', 'p-art']);
    expect((g.pages as Rec[]).map((p) => p.id)).toEqual(['p-logo']);
    expect(els(d).map((e) => e.id)).toEqual(['on-info', 'on-art', 'nowhere']);
    expect(els(g).map((e) => e.id)).toEqual(['on-logo', 'pic', 'arrow']);
    expect(Object.keys(d.articles as Rec)).toEqual(['f1', 'orphan']);
    expect(g.articles).toBeUndefined();
    expect(d.opensIn).toBe('pages');
    expect(g.opensIn).toBe('pages');
    expect(docs.tabs[0]!.elementCount).toBe(3);
  });

  it('moves each element with its page when the half lays its pages out again', () => {
    const r = splitOldDocument(mixed(), hooks());
    const d = body(part(r.parts, 'livedocuments'), 'pg');
    const g = body(part(r.parts, 'livedesign'), 'new:doc1:pg:livedesign');
    // The logo page now starts the row at the anchor (x 0): 874 to the left of where it was.
    expect((g.pages as Rec[])[0]!.rowAt).toEqual({ x: 0, y: 0 });
    expect(els(g)[0]).toMatchObject({ x: 900 - 874, y: 100 });
    expect(els(g)[2]!.to).toEqual({ kind: 'free', x: 1300 - 874, y: 300 });
    // The article page moved left by the logo page and its gap (512 + 80).
    expect(els(d)[1]).toMatchObject({ x: 1500 - 592 });
    // On no page: unmoved, and with the documents half.
    expect(els(d)[2]).toMatchObject({ x: 100, y: 5000 });
  });

  it('gives each half the images it places', () => {
    const r = splitOldDocument(mixed(), hooks());
    expect(part(r.parts, 'livedesign').imageOwners).toEqual([
      { imageId: 'img-logo', owner: NEW_OWNER },
      { imageId: 'img-bg', owner: NEW_OWNER },
    ]);
    expect(part(r.parts, 'livedocuments').imageOwners).toEqual([]);
  });

  it('links to an element of the split tab follow the half it went to', () => {
    const r = splitOldDocument(mixed(), hooks());
    const d = els(body(part(r.parts, 'livediagram'), 'd1'));
    expect(d[0]!.link).toEqual({
      kind: 'url',
      url: 'https://livedesign.app/design/new%3Adoc1%3Alivedesign#t=new%3Adoc1%3Apg%3Alivedesign',
    });
    expect(d[1]!.link).toEqual({
      kind: 'url',
      url: 'https://livedocuments.app/document/new%3Adoc1%3Alivedocuments#t=pg',
    });
    expect(r.crossReferences.filter((c) => c.kind === 'link').map((c) => c.to)).toEqual([
      { app: 'livedesign', id: 'new:doc1:livedesign', tabId: 'new:doc1:pg:livedesign' },
      { app: 'livedocuments', id: 'new:doc1:livedocuments', tabId: 'pg' },
    ]);
  });
});

describe('splitOldDocument: references that cross products', () => {
  it('freezes a tab window onto a tab that went elsewhere into a picture slot and a link', () => {
    const window = {
      ...shape('w1', 10, 20),
      shape: 'tab-window',
      windowTabId: 'd1',
      width: 640,
      height: 360,
    };
    const r = splitOldDocument(
      doc([
        { id: 'd1', body: diagramTab() },
        { id: 's1', body: slideTab([window]) },
      ]),
      hooks(),
    );
    const slot = els(body(part(r.parts, 'livedocuments'), 's1'))[0];
    expect(slot).toEqual({
      id: 'w1',
      type: 'image',
      x: 10,
      y: 20,
      width: 640,
      height: 360,
      imageId: null,
      objectFit: 'contain',
      link: { kind: 'url', url: 'https://www.livediagram.app/document/doc1#t=d1' },
    });
    expect(r.crossReferences).toEqual([
      {
        from: { app: 'livedocuments', id: 'new:doc1:livedocuments', tabId: 's1', elementId: 'w1' },
        to: { app: 'livediagram', id: 'doc1', tabId: 'd1' },
        kind: 'tab-window',
        picture: { tabId: 'd1', elementId: null },
      },
    ]);
  });

  it('keeps a tab window onto a tab in the same part', () => {
    const window = { ...shape('w1', 0, 0), shape: 'tab-window', windowTabId: 's2' };
    const r = splitOldDocument(
      doc([
        { id: 's1', body: slideTab([window]) },
        { id: 's2', body: slideTab() },
      ]),
      hooks(),
    );
    expect(els(body(r.parts[0]!, 's1'))[0]).toMatchObject({
      shape: 'tab-window',
      windowTabId: 's2',
    });
    expect(r.crossReferences).toEqual([]);
  });

  it('a chart reading a sheet that went to liveplanner keeps its values, loses the range, links to the sheet', () => {
    const chart = {
      ...shape('c1', 0, 0),
      shape: 'pie',
      chartSource: { sheetId: 'sheet01', range: {} },
      data: [1],
    };
    const r = splitOldDocument(
      doc(
        [
          { id: 'd1', body: diagramTab([chart]) },
          { id: 'sh', body: { kind: 'sheet', elements: [] } },
        ],
        {
          plan: plan({
            sheets: [
              {
                id: 'sheet01',
                tabId: 'sh',
                title: 'S',
                layout: '{}',
                rev: 1,
                createdAt: 1,
                updatedAt: 1,
                updatedBy: null,
              },
            ],
            cells: [{ sheetId: 'sheet01', rowId: 'r1', colId: 'c1', input: '4', format: null }],
          }),
        },
      ),
      hooks(),
    );
    const c = els(body(part(r.parts, 'livediagram'), 'd1'))[0]!;
    expect(c.chartSource).toBeUndefined();
    expect(c.data).toEqual([1]);
    expect(c.link).toEqual({
      kind: 'url',
      url: 'https://liveplanner.app/project/new%3Adoc1%3Aliveplanner#t=sh',
    });
    expect(r.crossReferences[0]).toMatchObject({
      kind: 'chart-source',
      to: { app: 'liveplanner', tabId: 'sh' },
    });
    expect(r.crossReferences[0]!.picture).toBeUndefined();
    const p = part(r.parts, 'liveplanner').plan!;
    expect(p.sheets.map((s) => s.id)).toEqual(['sheet01']);
    expect(p.cells).toHaveLength(1);
  });

  it('freezes a legacy Plan board on a Diagram tab into a picture of itself', () => {
    const board = { ...shape('pb', 5, 5), shape: 'plan-board', planBoard: {} };
    const r = splitOldDocument(
      doc([
        { id: 'd1', body: diagramTab([board]) },
        { id: 'b1', body: boardTab() },
      ]),
      hooks(),
    );
    expect(els(body(part(r.parts, 'livediagram'), 'd1'))[0]).toMatchObject({
      id: 'pb',
      type: 'image',
      imageId: null,
    });
    expect(r.crossReferences[0]).toMatchObject({
      kind: 'plan-element',
      to: { app: 'liveplanner', tabId: null },
      picture: { tabId: 'd1', elementId: 'pb' },
    });
    // The board on its own Plan tab is liveplanner's and stays live.
    expect(els(body(part(r.parts, 'liveplanner'), 'b1'))[0]).toMatchObject({ shape: 'plan-board' });
  });

  it("rewrites tab links and this document's own links to the part that holds them", () => {
    const r = splitOldDocument(
      doc([
        {
          id: 'd1',
          body: diagramTab([
            shape('a', 0, 0, { link: { kind: 'tab', tabId: 's1' } }),
            shape('b', 0, 0, { link: { kind: 'tab', tabId: 'd2' } }),
            {
              id: 't',
              type: 'table',
              cells: [['x']],
              cellStyles: [[{ link: { kind: 'tab', tabId: 's1' } }]],
            },
          ]),
        },
        { id: 'd2', body: diagramTab() },
        {
          id: 's1',
          body: slideTab([
            shape('self', 0, 0, {
              link: { kind: 'document', documentId: 'doc1', name: 'Roadmap' },
            }),
            shape('other', 0, 0, { link: { kind: 'document', documentId: 'doc9', name: 'Other' } }),
          ]),
        },
      ]),
      hooks({ keptByOf: (id) => (id === 'doc9' ? 'livedocuments' : null) }),
    );
    const d = els(body(part(r.parts, 'livediagram'), 'd1'));
    expect(d[0]!.link).toEqual({
      kind: 'url',
      url: 'https://livedocuments.app/document/new%3Adoc1%3Alivedocuments#t=s1',
    });
    expect(d[1]!.link).toEqual({ kind: 'tab', tabId: 'd2' });
    expect(((d[2]!.cellStyles as Rec[][])[0]![0] as Rec).link).toMatchObject({ kind: 'url' });
    const s = els(body(part(r.parts, 'livedocuments'), 's1'));
    expect(s[0]!.link).toEqual({ kind: 'url', url: 'https://www.livediagram.app/document/doc1' });
    expect(s[1]!.link).toEqual({ kind: 'document', documentId: 'doc9', name: 'Other' });
  });

  it("writes a link to another document as livedesign's own kind of link", () => {
    const r = splitOldDocument(
      doc([
        {
          id: 'l1',
          body: {
            opensIn: 'pages',
            pages: [{ id: 'p', kind: 'logo' }],
            elements: [
              shape('x', 0, 0, { link: { kind: 'document', documentId: 'doc7', name: 'Mark' } }),
            ],
          },
        },
      ]),
      hooks({ keptByOf: () => 'livedesign' }),
    );
    expect(els(body(r.parts[0]!, 'l1'))[0]!.link).toEqual({
      kind: 'design',
      designId: 'doc7',
      name: 'Mark',
    });
  });

  it('uses the hooks for addresses when given', () => {
    const r = splitOldDocument(
      doc([
        { id: 'd1', body: diagramTab([shape('a', 0, 0, { link: { kind: 'tab', tabId: 's1' } })]) },
        { id: 's1', body: slideTab() },
      ]),
      hooks({ partUrl: (app, id, tab) => `x:${app}/${id}/${tab}` }),
    );
    expect(els(body(r.parts[0]!, 'd1'))[0]!.link).toEqual({
      kind: 'url',
      url: 'x:livedocuments/new:doc1:livedocuments/s1',
    });
  });
});

describe('splitOldDocument: Plan data', () => {
  const item = (createdBy: string, fields: Rec) => ({
    id: 'i1',
    type: 'task',
    itemKey: 1,
    rank: 'a',
    fields: JSON.stringify(fields),
    rev: 1,
    createdAt: 1,
    updatedAt: 1,
    createdBy,
    updatedBy: createdBy,
  });

  it("recomputes card people for liveplanner's prefix and the owner map", () => {
    const ali = { id: oldItemPersonId(OWNER), name: 'Ali', color: '#f00' };
    const bo = { id: oldItemPersonId('user_bo'), name: 'Bo', color: '#0f0' };
    const stranger = { id: 'ffffffffffffffffffffffff', name: '?', color: '#000' };
    const r = splitOldDocument(
      doc([{ id: 'b1', body: boardTab() }], {
        people: ['user_bo'],
        plan: plan({
          items: [
            item(JSON.stringify(ali), {
              assignee: bo,
              votes: [ali.id],
              other: stranger,
              title: 'x',
            }),
          ],
        }),
      }),
      hooks(),
    );
    const p = r.parts[0]!.plan!;
    const it0 = p.items[0]!;
    expect(JSON.parse(it0.createdBy!)).toEqual({ ...ali, id: plannerItemPersonId(NEW_OWNER) });
    const fields = JSON.parse(it0.fields) as Rec;
    expect(fields.assignee).toEqual({ ...bo, id: plannerItemPersonId('user_bo') });
    expect(fields.votes).toEqual([plannerItemPersonId(NEW_OWNER)]);
    expect(fields.other).toEqual(stranger);
    expect(r.notes.some((n) => n.startsWith('1 card or sheet person'))).toBe(true);
  });

  it('keeps cards with no Plan tab in a tabless liveplanner part, and drops sheets on other tabs', () => {
    const r = splitOldDocument(
      doc([{ id: 'd1', body: diagramTab() }], {
        plan: plan({
          items: [item('{}', {})],
          sheets: [
            {
              id: 'sheet01',
              tabId: 'd1',
              title: 'S',
              layout: '{}',
              rev: 1,
              createdAt: 1,
              updatedAt: 1,
              updatedBy: null,
            },
          ],
        }),
      }),
      hooks(),
    );
    const p = part(r.parts, 'liveplanner');
    expect(p.tabs).toEqual([]);
    expect(p.plan!.items).toHaveLength(1);
    expect(p.plan!.sheets).toEqual([]);
    expect(r.notes.join('\n')).toMatch(/no Plan tab/);
    expect(r.notes.join('\n')).toMatch(/sheet sheet01.*dropped/);
  });

  it('gives a Plan tab with no Plan rows an empty plan', () => {
    const r = splitOldDocument(doc([{ id: 'b1', body: boardTab() }]), hooks());
    expect(r.parts[0]!.plan).toMatchObject({ items: [], sheets: [], itemsNextKey: 1 });
  });
});

describe('splitOldDocument: images', () => {
  it('grants each part only the images it places that its owner did not upload', () => {
    const img = (id: string, imageId: string) => ({
      id,
      type: 'image',
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      imageId,
    });
    const r = splitOldDocument(
      doc(
        [
          { id: 'd1', body: diagramTab([img('a', 'img-mine'), img('b', 'ext-theirs')]) },
          { id: 's1', body: slideTab([img('c', 'ext-granted'), img('d', 'lost')]) },
        ],
        {
          imageGrants: [
            { imageId: 'ext-granted', createdAt: 77 },
            { imageId: 'ext-unused', createdAt: 1 },
          ],
        },
      ),
      hooks(),
    );
    const d = part(r.parts, 'livediagram');
    const s = part(r.parts, 'livedocuments');
    expect(d.imageOwners.map((o) => o.imageId)).toEqual(['img-mine', 'ext-theirs']);
    expect(d.imageGrants).toEqual([{ imageId: 'ext-theirs', createdAt: 1000 }]);
    expect(s.imageGrants).toEqual([{ imageId: 'ext-granted', createdAt: 77 }]);
    expect(s.imageOwners).toEqual([{ imageId: 'ext-granted', owner: 'acct_bo' }]);
    expect(r.notes.some((n) => n.includes('image lost'))).toBe(true);
  });
});

describe('splitLocalDocument', () => {
  it('keeps livediagram tabs raw (the same object when untouched) and sends the rest to fresh parts', () => {
    const plain = { id: 'd1', name: 'Diagram', elements: [shape('s', 0, 0)] };
    const withWindow = {
      id: 'd2',
      name: 'With window',
      folder: 'f1',
      elements: [{ ...shape('w', 0, 0), shape: 'tab-window', windowTabId: 's1' }],
    };
    const slides = { id: 's1', name: 'Deck', ...slideTab() };
    const r = splitLocalDocument(
      { id: 'local1', name: 'Mine', tabs: [plain, withWindow, slides] },
      hooks(),
    );
    expect(r.keep[0]).toBe(plain);
    const kept = r.keep[1] as Rec;
    expect(kept).toMatchObject({ id: 'd2', name: 'With window', folder: 'f1' });
    expect(kept.upgraded).toBeUndefined();
    expect(els(kept)[0]).toMatchObject({
      type: 'image',
      imageId: null,
      link: {
        kind: 'url',
        url: 'https://livedocuments.app/document/new%3Alocal1%3Alivedocuments#t=s1',
      },
    });
    expect(r.parts.map((p) => [p.app, p.id])).toEqual([
      ['livedocuments', 'new:local1:livedocuments'],
    ]);
    expect(body(r.parts[0]!, 's1').upgraded).toBe(true);
  });

  it('notes that Plan tabs with no local stores carry no cards', () => {
    const r = splitLocalDocument(
      { id: 'l', name: 'n', tabs: [{ id: 'b1', name: 'B', ...boardTab() }] },
      hooks(),
    );
    expect(r.parts[0]!.plan).toMatchObject({ items: [] });
    expect(r.notes.join('\n')).toMatch(/no Plan data came with the local record/);
  });

  it("carries a local record's cards and sheets, people recomputed for the caller", () => {
    const me = { id: oldItemPersonId('guest-uuid'), name: 'Me', color: '#123456' };
    const r = splitLocalDocument(
      {
        id: 'l',
        name: 'n',
        ownerId: 'guest-uuid',
        tabs: [{ id: 'sh', name: 'Sheet', kind: 'sheet', elements: [] }],
        items: [
          {
            id: 'i1',
            type: 'task',
            key: 1,
            rank: 'a',
            fields: {},
            rev: 1,
            createdAt: 1,
            updatedAt: 1,
            createdBy: me,
            updatedBy: me,
          },
        ],
        sheets: [
          {
            id: 'sheet01',
            tabId: 'sh',
            title: 'S',
            layout: { rows: [] },
            cells: [{ r: 'r1', c: 'c1', i: '=1+1' }],
            rev: 2,
            createdAt: 1,
            updatedAt: 1,
            updatedBy: me,
          },
        ],
      },
      hooks({ ownerOf: () => 'acct_caller' }),
    );
    const p = r.parts[0]!;
    expect(p.ownerId).toBe('acct_caller');
    expect((JSON.parse(p.plan!.items[0]!.createdBy!) as Rec).id).toBe(
      plannerItemPersonId('acct_caller'),
    );
    expect(p.plan!.cells).toEqual([
      { sheetId: 'sheet01', rowId: 'r1', colId: 'c1', input: '=1+1', format: null },
    ]);
  });
});

describe('hasRetiredContent', () => {
  it.each([
    [{ elements: [] }, false],
    [{ opensIn: 'draw', elements: [shape('a', 0, 0)] }, false],
    [{ kind: 'event-storming', elements: [] }, false],
    [{ opensIn: 'illustrate', elements: [] }, true],
    [{ kind: 'dashboard', elements: [] }, true],
    [{ opensIn: 'plan', elements: [] }, true],
    [{ pageOrientation: 'portrait', elements: [] }, true],
    [{ elements: [{ type: 'shape', shape: 'tab-window' }] }, true],
    [{ elements: [{ type: 'shape', shape: 'plan-card' }] }, true],
    [{ elements: [{ type: 'annotation', articleNote: 'action' }] }, true],
    [{ elements: [{ type: 'shape', chartSource: {} }] }, true],
    [null, false],
    ['tab', false],
  ])('%j -> %s', (tab, expected) => {
    expect(hasRetiredContent(tab)).toBe(expected);
  });
});
