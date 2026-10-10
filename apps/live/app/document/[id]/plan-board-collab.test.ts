import { describe, expect, it } from 'vitest';
import type { Element, Tab } from '@livediagram/document';
import type { RoomOp } from '@livediagram/api-schema';
import { presetSetup, type PlanBoardSetup } from '@livediagram/items';
import { moveColumn, renameColumn } from '@/components/plan/board-setup-edits';
import { EL_OP_BROADCAST_LIMIT, tabBroadcastOps } from './tab-broadcast-ops';
import { applyRoomOpToTabs } from './room-op-apply';

// Two people set up one Plan board at once (docs/specs/012-collaboration/collab-race-hardening.md, phase 6).
// Each edits through the board's own controls (no selection, so no lock), saves, and receives the other's
// ops. Before the set-up travelled as a delta, each took the other's whole element and the screens
// diverged, each holding only the other's change.

const board = (planBoard: PlanBoardSetup): Element =>
  ({
    id: 'b',
    type: 'shape',
    shape: 'plan-board',
    x: 0,
    y: 0,
    width: 1200,
    height: 600,
    planBoard,
  }) as Element;

const tabWith = (planBoard: PlanBoardSetup): Tab => ({
  id: 't',
  name: 'Board',
  elements: [board(planBoard)],
});

const setupOf = (tabs: Tab[]): PlanBoardSetup =>
  (tabs[0]!.elements[0] as Element & { planBoard: PlanBoardSetup }).planBoard;

// One peer's edit: what it now shows, and the ops its autosave sends.
function edit(base: Tab, change: (s: PlanBoardSetup) => PlanBoardSetup) {
  const after = tabWith(change(setupOf([base])));
  return { tabs: [after], ops: tabBroadcastOps(base, after) };
}

const receive = (tabs: Tab[], ops: RoomOp[]) => ops.reduce(applyRoomOpToTabs, tabs);

describe('two peers setting up one board', () => {
  const base = tabWith(presetSetup('kanban'));
  const col = (name: string) => setupOf([base]).columns.find((c) => c.name === name)!;
  const todo = col('To Do');
  const doing = col('In Progress');
  const review = col('Review');

  it('keep both renames of different columns, and agree', () => {
    const a = edit(base, (s) => renameColumn(s, todo.id, 'Ready'));
    const b = edit(base, (s) => renameColumn(s, review.id, 'Checking'));
    const onA = setupOf(receive(a.tabs, b.ops));
    const onB = setupOf(receive(b.tabs, a.ops));
    expect(onA).toEqual(onB);
    expect(onA.columns.map((c) => c.name)).toContain('Ready');
    expect(onA.columns.map((c) => c.name)).toContain('Checking');
  });

  it('keep a rename and a move made at the same time', () => {
    const a = edit(base, (s) => renameColumn(s, doing.id, 'Building'));
    const b = edit(base, (s) => moveColumn(s, review.id, -1));
    const onA = setupOf(receive(a.tabs, b.ops));
    const onB = setupOf(receive(b.tabs, a.ops));
    expect(onA).toEqual(onB);
    const names = onA.columns.map((c) => c.name);
    expect(names).toContain('Building');
    expect(names.indexOf('Review')).toBeLessThan(names.indexOf('Building'));
  });

  it('send the set-up as a delta, not a whole element', () => {
    const a = edit(base, (s) => renameColumn(s, todo.id, 'Ready'));
    expect(a.ops.map((o) => o.kind)).toEqual(['el-delta']);
  });

  it('carry the set-up change beside a bulk whole-tab op, which the receiver merges keeping its own', () => {
    const many = Array.from(
      { length: EL_OP_BROADCAST_LIMIT + 1 },
      (_, i) =>
        ({
          id: `s${i}`,
          type: 'shape',
          shape: 'square',
          x: i,
          y: 0,
          width: 10,
          height: 10,
        }) as Element,
    );
    const after: Tab = {
      ...base,
      elements: [board(renameColumn(setupOf([base]), todo.id, 'Ready')), ...many],
    };
    const ops = tabBroadcastOps(base, after);
    expect(ops.map((o) => o.kind)).toEqual(['tab', 'el-delta']);
    const onPeer = receive([base], ops);
    expect(setupOf(onPeer).columns.map((c) => c.name)).toContain('Ready');
    expect(onPeer[0]!.elements).toHaveLength(EL_OP_BROADCAST_LIMIT + 2);
  });
});

describe("an agent's changeset", () => {
  it("takes the agent's copy of a board's set-up, since an agent sends no deltas", () => {
    const base = tabWith(presetSetup('kanban'));
    const next = renameColumn(setupOf([base]), setupOf([base]).columns[1]!.id, 'From agent');
    const tabs = applyRoomOpToTabs([base], {
      kind: 'changeset',
      tabId: 't',
      elementOps: [{ kind: 'update', element: board(next) }],
    } as RoomOp);
    expect(setupOf(tabs).columns.map((c) => c.name)).toContain('From Agent');
  });
});
