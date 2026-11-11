import { describe, expect, it } from 'vitest';
import { mergeSaveOverStored, type Element, type Page, type Tab } from '@livedesign/design';
import { readTabSaveChanges, type RoomOp } from '@livedesign/api-schema';
import { applyRoomOpToTabs } from './room-op-apply';
import { EL_OP_BROADCAST_LIMIT } from './tab-broadcast-ops';
import { prepareTabSave } from './tab-save-flow';

// Two Editors on one tab at the same moment (Work Tracker #669; docs/specs/012-collaboration/
// collab-race-hardening.md "Pages" and "A save is merged with the stored tab"): each saves from the same baseline,
// the room hands each the other's ops, and the store takes both saves in either order. Every screen and the store
// must end holding both pages.

const logo = (id: string): Page => ({ id, orientation: 'landscape' });
const box = (id: string): Element => ({
  id,
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 10,
  height: 10,
});
const tab = (over: Partial<Tab>): Tab => ({ id: 't1', name: 'Logos', elements: [], ...over });

type Editor = { screen: Tab[]; baseline: Tab[] };

// One editor's save: what it broadcasts and what the PUT stores. Once it lands the baseline is the snapshot saved.
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

describe('two Editors at once (#669)', () => {
  it('adding a page each keep both pages, live and after a reload, in one order', () => {
    const base = tab({ pages: [logo('p1'), logo('p2')] });
    const out = race(
      base,
      tab({ pages: [logo('p1'), logo('p2'), logo('pA')] }),
      tab({ pages: [logo('p1'), logo('p2'), logo('pB')] }),
    );
    const both = ['p1', 'p2', 'pA', 'pB'];
    expect(pageIds(out.gwen)).toEqual(both);
    expect(pageIds(out.hugo)).toEqual(both);
    expect(pageIds(out.gwenBaseline)).toEqual(both);
    expect(pageIds(out.storedGwenLast)).toEqual(both);
    expect(pageIds(out.storedHugoLast)).toEqual(both);
  });

  it('keep both pages when one add rides a whole-tab op (a page with many elements)', () => {
    const base = tab({ pages: [logo('p1')] });
    const many = Array.from({ length: EL_OP_BROADCAST_LIMIT + 1 }, (_, i) => box(`e${i}`));
    const out = race(
      base,
      tab({ pages: [logo('p1'), logo('pA')], elements: many }),
      tab({ pages: [logo('p1'), logo('pB')] }),
    );
    expect(pageIds(out.hugo)).toEqual(['p1', 'pA', 'pB']);
    expect(pageIds(out.gwen)).toEqual(['p1', 'pA', 'pB']);
  });

  it("take an older sender's page list whole, as before the steps", () => {
    const mine = tab({ pages: [logo('p1'), logo('pA')] });
    const op: RoomOp = {
      kind: 'tab-meta',
      tabId: 't1',
      patch: { pages: [logo('p1'), logo('pB')] },
    };
    expect(pageIds(applyRoomOpToTabs([mine], op)[0]!)).toEqual(['p1', 'pB']);
  });

  it('a page added and deleted across two quick saves stays deleted for the store', () => {
    const base = tab({ pages: [logo('p1')] });
    const first = tab({ pages: [logo('p1'), logo('pX')] });
    const second = prepareTabSave(base, base, undefined, first);
    const stored = mergeSaveOverStored(first, base, readTabSaveChanges(second.changes)!);
    expect(pageIds(stored)).toEqual(['p1']);
  });
});
