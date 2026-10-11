// Cell comments (docs/specs/029-sheets/sheet.md "Cell comments"): the thread helpers, the comment deltas naming a
// cell, the merge of a peer's whole element, the room ledger, validation, wire redaction, counts and undo.
import { describe, expect, it } from 'vitest';
import type { Comment, CommentThread, ElementLedger, ShapeElement, Tab, TabLedger } from './index';
import {
  CELL_THREADS_MAX,
  applyElementDelta,
  cellThreadsOf,
  duplicateElements,
  freshCopyFields,
  elementChangeIsDeltaOnly,
  elementThreads,
  elementValidationIssue,
  graftLiveTabState,
  isCellKey,
  ledgerKey,
  mapElementThreads,
  mergeIncomingElement,
  mergeLedgerIntoTab,
  opForTheWire,
  recordInLedger,
  tabLedgerFrom,
  tabStatsOf,
  threadAt,
  threadHolding,
  withThreadAt,
} from './index';

const sheet = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 'sh',
  type: 'shape',
  shape: 'plan-sheet',
  x: 0,
  y: 0,
  width: 960,
  height: 560,
  planSheet: { sheetId: 'sheet01' },
  ...over,
});

const square = (over: Partial<ShapeElement> = {}): ShapeElement => ({
  id: 'sq',
  type: 'shape',
  shape: 'square',
  x: 0,
  y: 0,
  width: 50,
  height: 50,
  ...over,
});

const comment = (id: string, over: Partial<Comment> = {}): Comment => ({
  id,
  text: id,
  createdAt: 1,
  authorName: 'Sam',
  authorColor: '#f00',
  ...over,
});

const thread = (...ids: string[]): CommentThread => ({
  comments: ids.map((id) => comment(id)),
  resolved: false,
});

const B4 = 'row004:colb01';
const C2 = 'row002:colc01';

describe('cell comment helpers', () => {
  it('reads and writes a cell thread beside the element thread', () => {
    let el = withThreadAt(sheet(), B4, thread('a'));
    el = withThreadAt(el, undefined, thread('own'));
    expect(threadAt(el, B4)?.comments[0]?.id).toBe('a');
    expect(threadAt(el)?.comments[0]?.id).toBe('own');
    expect(threadAt(el, C2)).toBeUndefined();
    expect(elementThreads(el).map((t) => t.cell ?? 'own')).toEqual(['own', B4]);
  });

  it('drops the field when the last cell thread goes', () => {
    const el = withThreadAt(withThreadAt(sheet(), B4, thread('a')), B4, undefined);
    expect('cellComments' in el).toBe(false);
  });

  it('ignores cell threads on anything but a Sheet', () => {
    const el = square();
    expect(withThreadAt(el, B4, thread('a'))).toBe(el);
  });

  it('never reads an inherited key as a cell thread', () => {
    expect(threadAt(sheet(), 'constructor')).toBeUndefined();
  });

  it('maps every thread, keeping identity when nothing changes', () => {
    const el = withThreadAt(withThreadAt(sheet(), B4, thread('a')), undefined, thread('own'));
    expect(mapElementThreads(el, (t) => t)).toBe(el);
    const resolved = mapElementThreads(el, (t, cell) => (cell ? { ...t, resolved: true } : t));
    expect(threadAt(resolved, B4)?.resolved).toBe(true);
    expect(threadAt(resolved)?.resolved).toBe(false);
    expect(cellThreadsOf(mapElementThreads(el, (t, cell) => (cell ? undefined : t)))).toBe(
      undefined,
    );
  });

  it('finds the thread holding a comment', () => {
    const el = withThreadAt(withThreadAt(sheet(), B4, thread('a')), undefined, thread('own'));
    expect(threadHolding(el, 'a')?.cell).toBe(B4);
    expect(threadHolding(el, 'own')?.cell).toBeUndefined();
    expect(threadHolding(el, 'none')).toBeNull();
  });

  it('knows a cell key', () => {
    expect(isCellKey(B4)).toBe(true);
    expect(isCellKey('B4')).toBe(false);
    expect(isCellKey(4)).toBe(false);
  });
});

describe('comment deltas naming a cell', () => {
  it('adds to, resolves and reopens a cell thread, leaving the element thread alone', () => {
    let el = applyElementDelta(sheet(), { kind: 'comment-add', comment: comment('a'), cell: B4 });
    expect(threadAt(el, B4)?.comments.map((c) => c.id)).toEqual(['a']);
    expect(threadAt(el)).toBeUndefined();
    el = applyElementDelta(el, { kind: 'comment-resolve', resolved: true, cell: B4 });
    expect(threadAt(el, B4)?.resolved).toBe(true);
    // A new comment reopens it.
    el = applyElementDelta(el, { kind: 'comment-add', comment: comment('b'), cell: B4 });
    expect(threadAt(el, B4)).toEqual({ comments: [comment('a'), comment('b')], resolved: false });
  });

  it('removes and rekeys a comment in whichever thread holds it', () => {
    let el = applyElementDelta(sheet(), { kind: 'comment-add', comment: comment('a'), cell: B4 });
    el = applyElementDelta(el, { kind: 'comment-rekey', from: 'a', to: 'server-a' });
    expect(threadAt(el, B4)?.comments[0]?.id).toBe('server-a');
    el = applyElementDelta(el, { kind: 'comment-remove', commentId: 'server-a' });
    expect(cellThreadsOf(el)).toBeUndefined();
  });

  it('drops the local duplicate when the server copy is already in the cell thread', () => {
    let el = applyElementDelta(sheet(), {
      kind: 'comment-add',
      comment: comment('local', { authorId: 'me' }),
      cell: B4,
    });
    el = applyElementDelta(el, { kind: 'comment-add', comment: comment('srv'), cell: B4 });
    el = applyElementDelta(el, { kind: 'comment-rekey', from: 'local', to: 'srv' });
    expect(threadAt(el, B4)?.comments).toEqual([comment('srv', { authorId: 'me' })]);
  });

  it('refuses a malformed cell, or a cell on another element', () => {
    const s = sheet();
    expect(applyElementDelta(s, { kind: 'comment-add', comment: comment('a'), cell: 'B4' })).toBe(
      s,
    );
    const sq = square();
    expect(applyElementDelta(sq, { kind: 'comment-add', comment: comment('a'), cell: B4 })).toBe(
      sq,
    );
    expect(applyElementDelta(s, { kind: 'comment-resolve', resolved: true, cell: 'x' })).toBe(s);
  });

  it('refuses a new cell thread past the bound, still taking replies', () => {
    const cells: Record<string, CommentThread> = {};
    for (let i = 0; i < CELL_THREADS_MAX; i++)
      cells[`r${String(i).padStart(5, '0')}:colb01`] = thread(`c${i}`);
    const full = sheet({ cellComments: cells });
    expect(applyElementDelta(full, { kind: 'comment-add', comment: comment('x'), cell: B4 })).toBe(
      full,
    );
    const reply = applyElementDelta(full, {
      kind: 'comment-add',
      comment: comment('y'),
      cell: 'r00000:colb01',
    });
    expect(threadAt(reply, 'r00000:colb01')?.comments).toHaveLength(2);
  });

  it("keeps the receiver's cell threads over a peer's whole element", () => {
    const local = sheet({ cellComments: { [B4]: thread('a', 'b') } });
    const incoming = sheet({ cellComments: { [B4]: thread('a') }, width: 999 });
    const merged = mergeIncomingElement(local, incoming) as ShapeElement;
    expect(merged.width).toBe(999);
    expect(merged.cellComments).toBe(local.cellComments);
    // None locally: the peer's snapshot copy goes too.
    expect('cellComments' in mergeIncomingElement(sheet(), incoming)).toBe(false);
  });

  it('counts a cell-thread-only change as delta-only', () => {
    const before = sheet();
    const after = sheet({ cellComments: { [B4]: thread('a') } });
    expect(elementChangeIsDeltaOnly(before, after)).toBe(true);
  });
});

describe('the room ledger with cell threads', () => {
  const op = (d: Record<string, unknown>) => ({
    kind: 'el-delta',
    tabId: 't1',
    elementId: 'sh',
    delta: d,
  });
  function ledgerOf(ops: unknown[]): TabLedger {
    const store = new Map<string, unknown>();
    ops.forEach((o, i) => {
      const key = ledgerKey(o)!;
      const next = recordInLedger(store.get(key) as ElementLedger | undefined, o, i + 1);
      if (next) store.set(key, next);
    });
    return tabLedgerFrom('t1', store);
  }
  const tab = (el: ShapeElement): Tab => ({ id: 't1', name: 'T', elements: [el] });

  it('puts back cell comments and cell resolves the saver had not seen', () => {
    const ledger = ledgerOf([
      op({ kind: 'comment-add', comment: comment('a'), cell: B4 }),
      op({ kind: 'comment-add', comment: comment('b'), cell: C2 }),
      op({ kind: 'comment-resolve', resolved: true, cell: C2 }),
    ]);
    const merged = mergeLedgerIntoTab(tab(sheet()), ledger, 0).elements[0]!;
    expect(threadAt(merged, B4)?.comments.map((c) => c.id)).toEqual(['a']);
    expect(threadAt(merged, C2)?.resolved).toBe(true);
    expect(threadAt(merged)).toBeUndefined();
  });

  it('drops a delta with a malformed cell', () => {
    expect(
      recordInLedger(undefined, op({ kind: 'comment-add', comment: comment('a'), cell: 'B4' }), 1),
    ).toBeNull();
    expect(
      recordInLedger(undefined, op({ kind: 'comment-resolve', resolved: true, cell: 7 }), 1),
    ).toBeNull();
  });

  it('applies only the cell resolves past the cursor', () => {
    const ledger = ledgerOf([
      op({ kind: 'comment-add', comment: comment('a'), cell: B4 }),
      op({ kind: 'comment-resolve', resolved: true, cell: B4 }),
    ]);
    const seen = sheet({ cellComments: { [B4]: thread('a') } });
    const merged = mergeLedgerIntoTab(tab(seen), ledger, 2).elements[0]!;
    expect(threadAt(merged, B4)?.resolved).toBe(false);
  });
});

describe('cell threads elsewhere in the model', () => {
  it('validates the field', () => {
    expect(elementValidationIssue(sheet({ cellComments: { [B4]: thread('a') } }))).toBeNull();
    for (const bad of [
      [],
      { B4: thread('a') },
      { [B4]: { comments: [], resolved: 'no' } },
      { [B4]: { comments: [{ id: 1 }], resolved: false } },
    ]) {
      expect(
        elementValidationIssue({ ...sheet(), cellComments: bad })?.field,
        JSON.stringify(bad),
      ).toBe('cellComments');
    }
  });

  it('keeps author ids off the wire in cell threads', () => {
    const el = sheet({
      cellComments: {
        [B4]: { comments: [comment('a', { authorId: 'owner-1', tokenId: 't' })], resolved: false },
      },
    });
    const out = opForTheWire({ kind: 'el', op: { kind: 'update', element: el } }) as {
      op: { element: ShapeElement };
    };
    expect(out.op.element.cellComments![B4]!.comments[0]).toEqual(comment('a'));
  });

  it('counts cell comments in the tab stats', () => {
    const el = sheet({ commentThread: thread('own'), cellComments: { [B4]: thread('a', 'b') } });
    expect(tabStatsOf({ elements: [el] }, '{}').commentCount).toBe(3);
  });

  it('keeps cell threads through an undo, as a live field', () => {
    const live: Tab = {
      id: 't',
      name: 't',
      elements: [sheet({ cellComments: { [B4]: thread('a') } })],
    };
    const snapshot: Tab = { id: 't', name: 't', elements: [sheet()] };
    const [restored] = graftLiveTabState([live], [snapshot]);
    expect(threadAt(restored!.elements[0]!, B4)?.comments[0]?.id).toBe('a');
  });
});

describe('copies of a Sheet', () => {
  it('never carry its cell threads', () => {
    const el = sheet({ cellComments: { [B4]: thread('a') } });
    expect(
      JSON.parse(JSON.stringify({ ...el, ...freshCopyFields(el) })).cellComments,
    ).toBeUndefined();
    const { newElements } = duplicateElements([el], new Set([el.id]), 10, 10);
    expect(JSON.parse(JSON.stringify(newElements[0])).cellComments).toBeUndefined();
    // Anything without cell threads gains no field.
    expect('cellComments' in freshCopyFields(square())).toBe(false);
  });
});
