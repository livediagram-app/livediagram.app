// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { EditorState, NodeSelection, TextSelection } from 'prosemirror-state';
import {
  applyArticleOps,
  diffArticleFlow,
  newArticleTable,
  type ArticleBlock,
  type ArticleFlow,
} from '@livedocuments/document';
import { blocksToDoc, docToBlocks } from './article-convert';
import { heldBackBlocks } from './article-hold-commit';
import {
  articleHoldsKey,
  articleHoldsPlugin,
  holdSpotOf,
  onlyHolds,
  setArticleHolds,
} from './article-holds';
import type { ArticlePeerHold } from './article-holds-store';
import { replaceContentTr } from './article-replace';

// docs/specs/007-editor/article-pages.md "Holding a paragraph": a collaborator's hold outlined with their name, our
// typing into it refused, and two people starting in one paragraph never losing the first writer's words.

const table = newArticleTable('tbl', 2, 2, false);
const blocks: ArticleBlock[] = [
  { id: 'a', type: 'paragraph', runs: [{ text: 'First' }] },
  { id: 'b', type: 'paragraph', runs: [{ text: 'Second' }] },
  table,
  { id: 'c', type: 'paragraph', runs: [{ text: 'Third' }] },
];
const ann = (spot: Partial<ArticlePeerHold> = {}): ArticlePeerHold => ({
  id: 'ann',
  name: 'Ann',
  color: '#f00',
  blockId: 'b',
  ...spot,
});

function fresh(onRefused = vi.fn(), from: ArticleBlock[] = blocks) {
  const state = EditorState.create({
    doc: blocksToDoc(from),
    plugins: [articleHoldsPlugin(onRefused)],
  });
  return { state, onRefused };
}

// Where a block's text starts in `state`.
function textStart(state: EditorState, id: string): number {
  let at = -1;
  state.doc.forEach((node, pos) => {
    if (node.attrs.id === id) at = pos + 1;
  });
  return at;
}

// Where a cell's text starts: row `r`, column `c` of the table.
function cellStart(state: EditorState, r: number, c: number): number {
  let at = -1;
  state.doc.forEach((node, pos) => {
    if (node.attrs.id !== 'tbl') return;
    let rowPos = pos + 1;
    for (let i = 0; i < r; i += 1) rowPos += node.child(i).nodeSize;
    let cellPos = rowPos + 1;
    for (let j = 0; j < c; j += 1) cellPos += node.child(r).child(j).nodeSize;
    at = cellPos + 1;
  });
  return at;
}

const typed = (state: EditorState, at: number, text: string) =>
  state.apply(state.tr.insertText(text, at));

describe('where our hold is', () => {
  it('is the block at the caret, and in a table the cell by its row and column ids', () => {
    const { state } = fresh();
    const at = (pos: number) =>
      state.apply(state.tr.setSelection(TextSelection.create(state.doc, pos)));
    expect(holdSpotOf(at(textStart(state, 'b') + 2))).toEqual({ blockId: 'b' });
    expect(holdSpotOf(at(cellStart(state, 1, 1)))).toEqual({
      blockId: 'tbl',
      row: table.rows[1]!.id,
      col: table.cols[1]!.id,
    });
  });

  it('is nothing between blocks or in a block without an id, and a selected block is its own', () => {
    const { state } = fresh();
    const noId = EditorState.create({
      doc: blocksToDoc([{ id: '', type: 'paragraph', runs: [{ text: 'x' }] }]),
    });
    expect(
      holdSpotOf(noId.apply(noId.tr.setSelection(TextSelection.create(noId.doc, 1)))),
    ).toBeNull();
    const divided = EditorState.create({
      doc: blocksToDoc([{ id: 'd', type: 'divider' }, ...blocks]),
    });
    const onDivider = divided.apply(divided.tr.setSelection(NodeSelection.create(divided.doc, 0)));
    expect(holdSpotOf(onDivider)).toBeNull();
    expect(holdSpotOf(state)).toEqual({ blockId: 'a' });
  });
});

describe('the holds plugin', () => {
  it('outlines a held paragraph with a chip naming its writer, changing no text', () => {
    const { state } = fresh();
    const tr = setArticleHolds(state, [ann()]);
    expect(onlyHolds(tr)).toBe(true);
    expect(tr.getMeta('addToHistory')).toBe(false);
    const next = state.apply(tr);
    expect(next.doc).toBe(state.doc);
    const found = articleHoldsKey.getState(next)!.decorations.find();
    expect(found.map((d) => [d.from, d.to])).toEqual([
      [7, 15],
      [8, 8],
    ]);
    const chip = (found[1] as unknown as { type: { toDOM: () => HTMLElement } }).type.toDOM();
    expect(chip.dataset.name).toBe('Ann is writing');
    expect(chip.getAttribute('aria-hidden')).toBe('true');
    expect(chip.style.getPropertyValue('--article-held')).toBe('#f00');
  });

  it('follows a held block through a change elsewhere, outlines a cell, and drops a hold whose block went', () => {
    let { state } = fresh();
    const cell = ann({ blockId: 'tbl', row: table.rows[0]!.id, col: table.cols[1]!.id });
    state = state.apply(setArticleHolds(state, [ann(), cell, ann({ blockId: 'gone' })]));
    expect(articleHoldsKey.getState(state)!.decorations.find()).toHaveLength(4);
    state = typed(state, 1, 'More ');
    expect(articleHoldsKey.getState(state)!.decorations.find()[0]!.from).toBe(12);
    // A cell in a row or column the table no longer has holds nothing.
    const stray = ann({ blockId: 'tbl', row: 'nope', col: table.cols[0]!.id });
    const s2 = state.apply(
      setArticleHolds(state, [stray, ann({ blockId: 'a', row: 'r', col: 'c' })]),
    );
    expect(articleHoldsKey.getState(s2)!.decorations.find()).toEqual([]);
    expect(onlyHolds(s2.tr)).toBe(false);
  });

  it('refuses our typing, deleting, formatting or joining into a held paragraph, naming its writer', () => {
    const { state: s0, onRefused } = fresh();
    const state = s0.apply(setArticleHolds(s0, [ann()]));
    const b = textStart(state, 'b');
    expect(typed(state, b + 2, 'x').doc).toBe(state.doc);
    expect(onRefused).toHaveBeenLastCalledWith(ann());
    expect(state.apply(state.tr.delete(b, b + 3)).doc).toBe(state.doc);
    const bold = state.schema.marks.strong ?? Object.values(state.schema.marks)[0]!;
    expect(state.apply(state.tr.addMark(b, b + 3, bold.create())).doc).toBe(state.doc);
    // Backspace at the start of the next block joins it into the held one.
    const t = textStart(state, 'tbl') - 1;
    expect(state.apply(state.tr.delete(t - 1, t + 1)).doc).toBe(state.doc);
    // Joining the held block into the one before it reaches it too.
    expect(state.apply(state.tr.delete(b - 2, b)).doc).toBe(state.doc);
    expect(onRefused).toHaveBeenCalledTimes(5);
  });

  it('lets our typing elsewhere, a block put beside it and a collaborator’s change through', () => {
    const { state: s0, onRefused } = fresh();
    const state = s0.apply(setArticleHolds(s0, [ann()]));
    expect(typed(state, textStart(state, 'a') + 1, 'x').doc).not.toBe(state.doc);
    const before = textStart(state, 'b') - 1;
    const para = state.schema.nodes.paragraph!.create({ id: 'n' });
    expect(state.apply(state.tr.insert(before, para)).doc).not.toBe(state.doc);
    const remote = state.tr
      .insertText('peer', textStart(state, 'b'))
      .setMeta('article-remote', true);
    expect(state.apply(remote).doc).not.toBe(state.doc);
    expect(onRefused).not.toHaveBeenCalled();
    // With nobody holding anything, nothing is refused.
    const { state: none } = fresh(onRefused);
    expect(typed(none, textStart(none, 'b'), 'x').doc).not.toBe(none.doc);
    expect(onRefused).not.toHaveBeenCalled();
  });

  it('holds one cell: other cells take text, the held one and the table’s shape do not', () => {
    const { state: s0, onRefused } = fresh();
    const held = ann({ blockId: 'tbl', row: table.rows[0]!.id, col: table.cols[0]!.id });
    const state = s0.apply(setArticleHolds(s0, [held]));
    expect(typed(state, cellStart(state, 0, 1), 'ok').doc).not.toBe(state.doc);
    expect(typed(state, cellStart(state, 0, 0), 'no').doc).toBe(state.doc);
    // A change of shape: a row put into the table, or the table's column widths.
    const rowAt = textStart(state, 'tbl');
    const row = state.doc.nodeAt(rowAt)!;
    expect(state.apply(state.tr.insert(rowAt, row.copy(row.content))).doc).toBe(state.doc);
    expect(state.apply(state.tr.setNodeAttribute(rowAt - 1, 'cols', [])).doc).toBe(state.doc);
    expect(onRefused).toHaveBeenCalledTimes(3);
  });

  it('lets what a plugin appends through', () => {
    const { state: s0 } = fresh();
    const state = s0.apply(setArticleHolds(s0, [ann()]));
    const tr = state.tr
      .insertText('x', textStart(state, 'b'))
      .setMeta('appendedTransaction', state.tr);
    expect(state.apply(tr).doc).not.toBe(state.doc);
  });
});

// Two writers on one article, as two editors and the room between them: each commit goes as block ops, the room
// gives a paragraph to the first claim, and a claim's block commits only once the room has answered.
describe('two people typing into one paragraph never lose words', () => {
  type Writer = { name: string; state: EditorState; committed: ArticleFlow };
  const writer = (name: string): Writer => ({
    name,
    state: fresh(vi.fn(), blocks).state,
    committed: { blocks },
  });
  const commit = (w: Writer, others: Writer[], pending: string | null = null) => {
    const local = docToBlocks(w.state.doc, w.committed.blocks);
    const sent = heldBackBlocks(local, w.committed.blocks, pending);
    const ops = diffArticleFlow(w.committed, { blocks: sent });
    w.committed = { blocks: sent };
    for (const o of others) {
      const incoming = applyArticleOps(o.committed, ops);
      const mine = docToBlocks(o.state.doc, o.committed.blocks);
      const localOps = diffArticleFlow(o.committed, { blocks: mine }).filter(
        (op) => op.kind !== 'style',
      );
      o.committed = incoming;
      const merged = localOps.length ? applyArticleOps(incoming, localOps).blocks : incoming.blocks;
      const tr = replaceContentTr(o.state, merged, false);
      if (tr) o.state = o.state.apply(tr);
    }
  };
  const textOf = (w: Writer, id: string) => {
    const b = docToBlocks(w.state.doc, w.committed.blocks).find((x) => x.id === id);
    return b && 'runs' in b ? b.runs.map((r) => r.text).join('') : '';
  };

  it('keeps every word, the first writer’s in the paragraph they hold and the second’s where they could write', () => {
    const ann = writer('Ann');
    const bob = writer('Bob');
    const room = new Map<string, string>();
    const claim = (who: Writer, block: string) => {
      const holder = room.get(block);
      if (holder && holder !== who.name) return false;
      room.set(block, who.name);
      return true;
    };
    const tell = (w: Writer, holds: ArticlePeerHold[]) => {
      w.state = w.state.apply(setArticleHolds(w.state, holds));
    };

    // Both start in paragraph b before either hears of the other: Ann's claim reaches the room first.
    ann.state = typed(ann.state, textStart(ann.state, 'b') + 6, ' by Ann');
    bob.state = typed(bob.state, textStart(bob.state, 'b') + 6, ' by Bob');
    expect(claim(ann, 'b')).toBe(true);
    // Bob's commit while his claim is unanswered holds paragraph b back.
    commit(bob, [ann], 'b');
    expect(claim(bob, 'b')).toBe(false);
    tell(bob, [{ id: 'ann', name: 'Ann', color: '#f00', blockId: 'b' }]);
    // Refused: Bob's letters in b go back to how the room had them.
    const base = bob.committed.blocks;
    const back = heldBackBlocks(docToBlocks(bob.state.doc, base), base, 'b');
    bob.state = bob.state.apply(replaceContentTr(bob.state, back, false)!);
    commit(ann, [bob]);

    // Bob can no longer type in b, so he writes in a; Ann keeps typing in b.
    expect(typed(bob.state, textStart(bob.state, 'b') + 2, 'zzz').doc).toBe(bob.state.doc);
    bob.state = typed(bob.state, textStart(bob.state, 'a') + 5, ' and Bob');
    expect(claim(bob, 'a')).toBe(true);
    ann.state = typed(ann.state, textStart(ann.state, 'b') + 13, ' again');
    commit(bob, [ann]);
    commit(ann, [bob]);

    for (const w of [ann, bob]) {
      expect(textOf(w, 'b')).toBe('Second by Ann again');
      expect(textOf(w, 'a')).toBe('First and Bob');
    }
    expect(docToBlocks(ann.state.doc, ann.committed.blocks)).toEqual(
      docToBlocks(bob.state.doc, bob.committed.blocks),
    );
  });
});

describe('the cost of holds while typing', () => {
  it('keeps a keystroke in a 5,000-paragraph article with three holds inside its budget', () => {
    const many: ArticleBlock[] = Array.from({ length: 5000 }, (_, i) => ({
      id: `p${i}`,
      type: 'paragraph',
      runs: [{ text: 'word '.repeat(20).trim() }],
    }));
    let state = EditorState.create({
      doc: blocksToDoc(many),
      plugins: [articleHoldsPlugin(() => {})],
    });
    const holds = ['p10', 'p2500', 'p4990'].map((blockId, i) => ann({ id: `h${i}`, blockId }));
    state = state.apply(setArticleHolds(state, holds));
    // Typing at the start of the first paragraph, which nobody holds: the filter, the decorations and the apply.
    const spent = cpuMsOf(() => {
      for (let k = 0; k < 50; k += 1) state = state.apply(state.tr.insertText('x', 1));
    });
    expect(state.doc.firstChild!.textContent.startsWith('x'.repeat(50))).toBe(true);
    expect(spent / 50).toBeLessThan(cpuBudgetMs(8));
  });
});
