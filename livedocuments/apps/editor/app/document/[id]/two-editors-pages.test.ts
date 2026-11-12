import { describe, expect, it } from 'vitest';
import {
  mergeSaveOverStored,
  type ArticleBlock,
  type Element,
  type Page,
  type Tab,
} from '@livedocuments/document';
import { readTabSaveChanges, type RoomOp } from '@livedocuments/api-schema';
import { applyRoomOpToTabs } from './room-op-apply';
import { EL_OP_BROADCAST_LIMIT } from './tab-broadcast-ops';
import { prepareTabSave } from './tab-save-flow';

// Two Editors on one tab at the same moment (Work Tracker #669, #670; docs/specs/012-collaboration/
// collab-race-hardening.md "Pages" and "A save is merged with the stored tab"): each saves from the same baseline,
// the room hands each the other's ops, and the store takes both saves in either order. Every screen and the store
// must end holding both people's work.

const slide = (id: string): Page => ({ id, orientation: 'landscape', kind: 'slide' });
const para = (id: string, text: string): ArticleBlock => ({
  id,
  type: 'paragraph',
  runs: [{ text }],
});
const box = (id: string): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
});
const tab = (over: Partial<Tab>): Tab => ({ id: 't1', name: 'Deck', elements: [], ...over });

type Editor = { screen: Tab[]; baseline: Tab[] };

// One editor's save of its screen against its baseline: what it broadcasts and what the PUT stores. Once it lands
// the baseline is the snapshot saved.
function saveOf(editor: Editor) {
  const prepared = prepareTabSave(editor.baseline[0], editor.screen[0]!);
  editor.baseline = editor.screen;
  return {
    tab: editor.screen[0]!,
    ops: prepared.ops,
    changes: readTabSaveChanges(prepared.changes),
  };
}
// The room delivers a peer's ops: to the screen and to the baseline alike, as the editor does.
function receive(editor: Editor, ops: RoomOp[]): void {
  for (const op of ops) {
    editor.screen = applyRoomOpToTabs(editor.screen, op);
    editor.baseline = applyRoomOpToTabs(editor.baseline, op);
  }
}
function race(base: Tab, gwenTab: Tab, hugoTab: Tab) {
  const gwen: Editor = { screen: [gwenTab], baseline: [base] };
  const hugo: Editor = { screen: [hugoTab], baseline: [base] };
  const fromGwen = saveOf(gwen);
  const fromHugo = saveOf(hugo);
  receive(gwen, fromHugo.ops);
  receive(hugo, fromGwen.ops);
  const land = (stored: Tab, s: typeof fromGwen) => mergeSaveOverStored(stored, s.tab, s.changes!);
  return {
    gwen: gwen.screen[0]!,
    hugo: hugo.screen[0]!,
    gwenBaseline: gwen.baseline[0]!,
    storedGwenLast: land(land(base, fromHugo), fromGwen),
    storedHugoLast: land(land(base, fromGwen), fromHugo),
  };
}
const pageIds = (t: Tab) => (t.pages ?? []).map((p) => p.id);
const words = (t: Tab) =>
  (t.articles?.f1?.blocks ?? []).map((b) =>
    b.type === 'paragraph' ? b.runs.map((r) => r.text).join('') : b.id,
  );

describe('two Editors at once', () => {
  it('adding a slide each keep both slides, live and after a reload, in one order (#669)', () => {
    const base = tab({ pages: [slide('s1'), slide('s2')] });
    const out = race(
      base,
      tab({ pages: [slide('s1'), slide('s2'), slide('sA')] }),
      tab({ pages: [slide('s1'), slide('s2'), slide('sB')] }),
    );
    const both = ['s1', 's2', 'sA', 'sB'];
    expect(pageIds(out.gwen)).toEqual(both);
    expect(pageIds(out.hugo)).toEqual(both);
    expect(pageIds(out.gwenBaseline)).toEqual(both);
    expect(pageIds(out.storedGwenLast)).toEqual(both);
    expect(pageIds(out.storedHugoLast)).toEqual(both);
  });

  it('keep both slides when one add rides a whole-tab op (a slide with many elements)', () => {
    const base = tab({ pages: [slide('s1')] });
    const many = Array.from({ length: EL_OP_BROADCAST_LIMIT + 1 }, (_, i) => box(`e${i}`));
    const out = race(
      base,
      tab({ pages: [slide('s1'), slide('sA')], elements: many }),
      tab({ pages: [slide('s1'), slide('sB')] }),
    );
    expect(pageIds(out.hugo)).toEqual(['s1', 'sA', 'sB']);
    expect(pageIds(out.gwen)).toEqual(['s1', 'sA', 'sB']);
    expect(out.hugo.elements).toHaveLength(EL_OP_BROADCAST_LIMIT + 1);
  });

  it("writing in different paragraphs of one article keep both people's words after a reload (#670)", () => {
    const pages: Page[] = [{ id: 'p1', orientation: 'portrait', kind: 'article', flow: 'f1' }];
    const base = tab({
      pages,
      articles: { f1: { blocks: [para('b1', 'Intro'), para('b2', 'Body')] } },
    });
    const out = race(
      base,
      tab({
        pages,
        articles: { f1: { blocks: [para('b1', 'AAA from Gwen'), para('b2', 'Body')] } },
      }),
      tab({
        pages,
        articles: {
          f1: { blocks: [para('b1', 'Intro'), para('b2', 'Body'), para('b3', 'New line A')] },
        },
      }),
    );
    const all = ['AAA from Gwen', 'Body', 'New line A'];
    expect(words(out.gwen)).toEqual(all);
    expect(words(out.hugo)).toEqual(all);
    expect(words(out.storedGwenLast)).toEqual(all);
    expect(words(out.storedHugoLast)).toEqual(all);
  });

  it("take an older sender's page list whole, as before the steps", () => {
    const mine = tab({ pages: [slide('s1'), slide('sA')] });
    const op: RoomOp = {
      kind: 'tab-meta',
      tabId: 't1',
      patch: { pages: [slide('s1'), slide('sB')] },
    };
    expect(pageIds(applyRoomOpToTabs([mine], op)[0]!)).toEqual(['s1', 'sB']);
  });

  it('a page added and deleted across two quick saves stays deleted for peers and the store', () => {
    const base = tab({ pages: [slide('s1')] });
    const first = tab({ pages: [slide('s1'), slide('sX')] });
    const second = prepareTabSave(base, base, undefined, first);
    expect(readTabSaveChanges(second.changes)?.pages).toEqual([{ kind: 'remove', id: 'sX' }]);
    const stored = mergeSaveOverStored(first, base, readTabSaveChanges(second.changes)!);
    expect(pageIds(stored)).toEqual(['s1']);
  });
});
