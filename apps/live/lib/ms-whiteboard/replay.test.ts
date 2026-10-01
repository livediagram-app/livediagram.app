import { describe, expect, it } from 'vitest';
import { MSWB_TRAIT } from './format';
import {
  CANVAS_ID,
  command,
  history,
  num,
  point,
  shapeNode,
  treeInit,
  type RawNode,
} from './ms-whiteboard-fixtures';
import { replayBoard } from './replay';
import { children, single } from './tree';
import { readNumber } from './values';

const C = MSWB_TRAIT.children;
const ids = (board: ReturnType<typeof replayBoard>) => children(board!.canvas!, C).map((n) => n.id);
const box = (x = 0) => shapeNode({ x, y: 0, w: 10, h: 10 });
const xOf = (board: ReturnType<typeof replayBoard>, id: string) => {
  const pos = single(board!.index.nodes.get(id)!, MSWB_TRAIT.position)!;
  return readNumber(children(pos, C)[0]!.payload!);
};

// docs/specs/020-import-export/whiteboard-import.md "Replay".
describe('replayBoard', () => {
  it('finds the canvas by type and inserts after a sibling, else first', () => {
    const h = history();
    const [a, b, c] = [box(), box(), box()] as [RawNode, RawNode, RawNode];
    h.insert(CANVAS_ID, C, [a]);
    h.insert(CANVAS_ID, C, [b], { after: a.fuid });
    h.insert(CANVAS_ID, C, [c]);
    expect(ids(replayBoard(treeInit(), h.changes))).toEqual([c.fuid, a.fuid, b.fuid]);
  });

  it('inserts before a sibling', () => {
    const h = history();
    const [a, b] = [box(), box()] as [RawNode, RawNode];
    h.insert(CANVAS_ID, C, [a]);
    h.insert(CANVAS_ID, C, [b], { before: a.fuid });
    expect(ids(replayBoard(treeInit(), h.changes))).toEqual([b.fuid, a.fuid]);
  });

  it('deletes, replaces in place, and moves', () => {
    const h = history();
    const [a, b, c, d] = [box(), box(), box(), box()] as [RawNode, RawNode, RawNode, RawNode];
    h.insert(CANVAS_ID, C, [a, b, c]);
    h.remove(CANVAS_ID, C, a.fuid!);
    h.replace(CANVAS_ID, C, b.fuid!, [d]);
    h.move(CANVAS_ID, C, d.fuid!, { after: c.fuid });
    const board = replayBoard(treeInit(), h.changes);
    expect(ids(board)).toEqual([c.fuid, d.fuid]);
    expect(board!.index.nodes.has(a.fuid!)).toBe(false);
  });

  it('applies group commands in order: insert, delete, replace, move; tags change nothing', () => {
    const h = history();
    const [a, b, c] = [box(), box(), box()] as [RawNode, RawNode, RawNode];
    h.group([
      command.insert(CANVAS_ID, C, [a]),
      command.insert(CANVAS_ID, C, [b], a.fuid),
      command.tag(a.fuid!),
    ]);
    h.group([
      command.replace(CANVAS_ID, C, a.fuid!, [c]),
      command.move(CANVAS_ID, C, c.fuid!, b.fuid),
    ]);
    const board = replayBoard(treeInit(), h.changes);
    expect(ids(board)).toEqual([b.fuid, c.fuid]);
    expect(board!.stats.ignoredCommands).toBe(0);
  });

  it('moves an element by replacing its position value, and reads the latest value', () => {
    const h = history();
    const a = box(5);
    h.insert(CANVAS_ID, C, [a]);
    const oldPos = a.traits.find((t) => t.trait === MSWB_TRAIT.position)!.children[0]!;
    h.group([
      command.remove(a.fuid!, MSWB_TRAIT.position, oldPos.fuid!),
      command.insert(a.fuid!, MSWB_TRAIT.position, [point(40, 0)]),
    ]);
    // A concurrent edit from another window deletes the old value again and inserts its own.
    h.group([
      command.remove(a.fuid!, MSWB_TRAIT.position, oldPos.fuid!),
      command.insert(a.fuid!, MSWB_TRAIT.position, [point(70, 0)]),
    ]);
    const board = replayBoard(treeInit(), h.changes);
    expect(xOf(board, a.fuid!)).toBe(70);
    expect(board!.stats.skippedEdits).toBe(1);
  });

  it('applies changes in timestamp order, so a late-synced image insert comes before its edits', () => {
    const h = history();
    const a = box(1);
    const early = new Date(Date.UTC(2025, 11, 31));
    // The scale edit syncs first but was made after the (late-uploading) insert.
    h.group([command.insert(a.fuid!, MSWB_TRAIT.scale, [num(2)])]);
    h.lateImageInsert(CANVAS_ID, a, 'data-1', 'object-1', early);
    const board = replayBoard(treeInit(), h.changes);
    expect(ids(board)).toEqual([a.fuid]);
    expect(board!.stats.skippedEdits).toBe(0);
    expect(board!.imageObjects.get('data-1')).toBe('object-1');
  });

  it('leaves undone changes out and puts redone ones back', () => {
    const h = history();
    const [a, b, c] = [box(), box(), box()] as [RawNode, RawNode, RawNode];
    const ia = h.insert(CANVAS_ID, C, [a]);
    const ib = h.insert(CANVAS_ID, C, [b], { after: a.fuid });
    const ic = h.insert(CANVAS_ID, C, [c], { after: a.fuid });
    h.undo(ib);
    const undoC = h.undo(ic);
    h.redo(undoC);
    const board = replayBoard(treeInit(), h.changes);
    expect(ids(board)).toEqual([a.fuid, c.fuid]);
    expect(board!.stats.undone).toBe(1);
    void ia;
  });

  it('skips edits naming missing nodes, never throws', () => {
    const h = history();
    h.insert('nowhere', C, [box()]);
    h.remove(CANVAS_ID, C, 'gone');
    h.move(CANVAS_ID, C, 'gone', {});
    h.group([{ nrefIsa: 'unknown-command', traits: [] }, 'not a node' as unknown as RawNode]);
    const board = replayBoard(treeInit(), [...h.changes, null, 7, { type: 'FchMystery', gch: {} }]);
    expect(ids(board)).toEqual([]);
    expect(board!.stats.skippedEdits).toBe(3);
    expect(board!.stats.ignoredCommands).toBe(3);
  });

  it('lands an insert whose sibling is gone on top, and counts it', () => {
    const h = history();
    const [a, b] = [box(), box()] as [RawNode, RawNode];
    h.insert(CANVAS_ID, C, [a]);
    h.insert(CANVAS_ID, C, [b], { after: 'never-synced' });
    const board = replayBoard(treeInit(), h.changes);
    expect(ids(board)).toEqual([a.fuid, b.fuid]);
    expect(board!.stats.misplacedInserts).toBe(1);
  });

  it('still sets the value of a replace whose old value is gone', () => {
    const h = history();
    const a = box(5);
    h.insert(CANVAS_ID, C, [a]);
    h.group([command.replace(a.fuid!, MSWB_TRAIT.position, 'already-replaced', [point(90, 0)])]);
    const board = replayBoard(treeInit(), h.changes);
    expect(xOf(board, a.fuid!)).toBe(90);
    expect(board!.stats.staleReplaces).toBe(1);
  });

  it('keeps a moved run in place when its destination is gone', () => {
    const h = history();
    const a = box();
    h.insert(CANVAS_ID, C, [a]);
    h.move(CANVAS_ID, C, a.fuid!, { after: 'gone' });
    expect(ids(replayBoard(treeInit(), h.changes))).toEqual([a.fuid]);
  });

  it('refuses a starting tree that is not a node', () => {
    expect(replayBoard(null, [])).toBeNull();
    expect(replayBoard({ nope: 1 }, [])?.canvas ?? null).toBeNull();
  });
});
