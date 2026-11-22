import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection, type Transaction } from 'prosemirror-state';
import type { DecorationSet } from 'prosemirror-view';
import { newArticleTable, type ArticleBlock } from '@liveknowledge/document';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { blocksToDoc, docToBlocks } from './article-convert';
import { replaceContentTr } from './article-replace';
import { blockIdsPlugin, decorationsPlugin } from './article-plugins';
import { articleSchema as S } from './article-schema';

// docs/specs/007-editor/blueprints/article-pages.md "Keys, rules, slash menu" and
// docs/specs/008-canvas/canvas-performance.md: list markers and placeholders are kept from one change to the next
// and moved with the text, and they stay exactly what a fresh build gives.

const TEXT = 'The quick brown fox jumps over the lazy dog and keeps on running. ';

function article(blocks = 1500): ArticleBlock[] {
  const out: ArticleBlock[] = [{ id: 'title', type: 'paragraph', style: 'title', runs: [] }];
  for (let i = 1; i < blocks; i++) {
    const id = `b${i}`;
    if (i % 30 === 0)
      out.push({ id, type: 'paragraph', style: 'h2', runs: [{ text: `Section ${i}` }] });
    else if (i % 97 === 0) out.push({ id, type: 'paragraph', runs: [] });
    else if (i % 5 === 0)
      out.push({ id, type: 'list', list: i % 10 ? 'bullet' : 'numbered', runs: [{ text: TEXT }] });
    else if (i === 50) out.push(newArticleTable(id, 2, 2, true));
    else out.push({ id, type: 'paragraph', runs: [{ text: TEXT }] });
  }
  return out;
}

type Deco = { from: number; to: number; type: { attrs: Record<string, string> } };
const decosOf = (set: DecorationSet) =>
  (set.find() as unknown as Deco[])
    .map((d) => `${d.from}-${d.to}-${JSON.stringify(d.type.attrs)}`)
    .sort();

function shown(state: EditorState, plugin = decorationsPlugin(() => true)): DecorationSet {
  return (plugin.props.decorations as (s: EditorState) => DecorationSet).call(plugin, state);
}

// What a fresh editor on the same writing and caret draws.
function fresh(state: EditorState, editable = true): DecorationSet {
  const plugin = decorationsPlugin(() => editable);
  return shown(
    EditorState.create({ doc: state.doc, selection: state.selection, plugins: [plugin] }),
    plugin,
  );
}

function start(blocks: ArticleBlock[], editable = () => true) {
  const plugin = decorationsPlugin(editable);
  const state = EditorState.create({ doc: blocksToDoc(blocks), plugins: [blockIdsPlugin, plugin] });
  return { plugin, state };
}

// The start of the text of the top-level block at `index`.
function inBlock(state: EditorState, index: number): number {
  let pos = 0;
  for (let i = 0; i < index; i++) pos += state.doc.child(i).nodeSize;
  return pos + 1;
}

describe('decorationsPlugin', () => {
  it('keeps the markers and placeholders a fresh build gives, through typing, emptying, moving and restyling', () => {
    const started = start(article(120));
    const { plugin } = started;
    let { state } = started;
    const steps: ((s: EditorState) => Transaction)[] = [
      // Typing in a body paragraph, in a list item and in the title.
      (s) => s.tr.insertText('abc', inBlock(s, 3)),
      (s) => s.tr.insertText('x', inBlock(s, 5)),
      (s) => s.tr.insertText('Heading', inBlock(s, 0)),
      // The caret into an empty block, typing there, and out again.
      (s) => s.tr.setSelection(TextSelection.create(s.doc, inBlock(s, 97))),
      (s) => s.tr.insertText('now filled', inBlock(s, 97)),
      (s) => s.tr.setSelection(TextSelection.create(s.doc, inBlock(s, 2))),
      // A block emptied.
      (s) => s.tr.delete(inBlock(s, 4), inBlock(s, 4) + s.doc.child(4).content.size),
      // A list item restyled to numbered, and a block added and removed.
      (s) => s.tr.setNodeAttribute(inBlock(s, 15) - 1, 'list', 'numbered'),
      (s) => s.tr.insert(inBlock(s, 10) - 1, S.nodes.paragraph.create({ id: 'added' })),
      (s) => s.tr.delete(inBlock(s, 10) - 1, inBlock(s, 11) - 1),
      // Text typed into a table cell.
      (s) => {
        let cell = -1;
        s.doc.descendants((n, pos) => {
          if (cell < 0 && n.isTextblock && n.type !== S.nodes.paragraph) cell = pos + 1;
          return cell < 0;
        });
        return s.tr.insertText('cell', cell);
      },
      // A selection that is not a caret.
      (s) => s.tr.setSelection(TextSelection.create(s.doc, inBlock(s, 3), inBlock(s, 3) + 2)),
    ];
    for (const step of steps) {
      state = state.apply(step(state));
      expect(decosOf(shown(state, plugin))).toEqual(decosOf(fresh(state)));
    }
  });

  // A peer's write across several list items (an assistant's write_article) replaces those
  // items whole: their markers were mapped away with them and the list showed none until a reload.
  it('keeps list markers through a peer write that replaces several list items whole', () => {
    const started = start(article(40));
    const { plugin } = started;
    let { state } = started;
    const blocks = docToBlocks(state.doc).map((b): ArticleBlock =>
      b.type === 'list' && (b.id === 'b5' || b.id === 'b10' || b.id === 'b15')
        ? { ...b, runs: [...b.runs, { text: ' more', b: true }] }
        : b,
    );
    const tr = replaceContentTr(state, blocks, false);
    expect(tr).not.toBeNull();
    state = state.apply(tr!);
    const markers = decosOf(shown(state, plugin)).filter((d) => d.includes('data-marker'));
    expect(markers.length).toBeGreaterThan(0);
    expect(decosOf(shown(state, plugin))).toEqual(decosOf(fresh(state)));
  });

  it('follows the editable flag read live, with or without a transaction', () => {
    let editable = true;
    const { plugin, state } = start(article(40), () => editable);
    const withPlaceholders = decosOf(shown(state, plugin));
    editable = false;
    expect(decosOf(shown(state, plugin))).toEqual(decosOf(fresh(state, false)));
    expect(decosOf(shown(state, plugin))).not.toEqual(withPlaceholders);
    const next = state.apply(state.tr.insertText('a', inBlock(state, 2)));
    expect(decosOf(shown(next, plugin))).toEqual(decosOf(fresh(next, false)));
    editable = true;
    const back = next.apply(next.tr.insertText('b', inBlock(next, 2)));
    expect(decosOf(shown(back, plugin))).toEqual(decosOf(fresh(back)));
  });

  it('says Untitled Page for an empty Title while reading, and Title while writing', () => {
    const blocks: ArticleBlock[] = [
      { id: 'title', type: 'paragraph', style: 'title', runs: [] },
      { id: 'b1', type: 'paragraph', runs: [{ text: TEXT }] },
    ];
    const placeholders = (editable: boolean) =>
      decosOf(fresh(start(blocks, () => editable).state, editable)).filter((d) =>
        d.includes('data-placeholder'),
      );
    expect(placeholders(false).join()).toContain('Untitled Page');
    expect(placeholders(true).join()).toContain('"data-placeholder":"Title"');
    const named = start(
      [{ id: 'title', type: 'paragraph', style: 'title', runs: [{ text: 'Named' }] }, blocks[1]!],
      () => false,
    );
    expect(decosOf(fresh(named.state, false)).join()).not.toContain('Untitled Page');
  });

  it('hands the same set on for a change that touches neither the writing nor the caret', () => {
    const { plugin, state } = start(article(40));
    const next = state.apply(state.tr.setMeta('anything', true));
    expect(shown(next, plugin)).toBe(shown(state, plugin));
  });

  // A key typed into a 1,500-block (about 50-page) article worked every marker and placeholder out again: about
  // 2.5 ms a key on a laptop, a hundred keys 265 ms (with the editor's own 14 ms of applying them). Moved with the
  // text instead, the hundred keys take about 15 ms in all. Measured 2026-11-09 on a busy laptop (load 67 on 10
  // cores): moved, 42 to 56 ms plain and 75 to 98 under coverage; rebuilt, 305 to 343 plain and 1,660 to 1,910 under
  // coverage. CI's coverage run measured 200 moved, so 150 (450 on CI and under coverage) keeps room there and still
  // fails a rebuild in either mode.
  it('costs a key typed into a long article a move of the set, not a rebuild', () => {
    const started = start(article());
    const { plugin } = started;
    let { state } = started;
    shown(state, plugin);
    const at = inBlock(state, 3);
    const spent = cpuMsOf(() => {
      for (let i = 0; i < 100; i++) {
        state = state.apply(state.tr.insertText('a', at + i));
        shown(state, plugin);
      }
    });
    expect(spent).toBeLessThan(cpuBudgetMs(150));
  });
});

// Work Tracker 1052: after Move Documents on sign-in, a reported article showed its list items with no markers until
// a reload. Whatever the writing becomes from outside (a peer, an undo, a reloaded copy), and whether the editor
// turns editable or read-only meanwhile, the markers drawn are always the ones a fresh editor draws.
describe('list markers after the writing is replaced from outside', () => {
  let seed = 1052;
  const rnd = (n: number) => {
    seed = (seed * 16807) % 2147483647;
    return seed % n;
  };
  const TEXTS = ['', 'a', 'Ever', 'Every word'];
  const LISTS = ['bullet', 'numbered', 'todo'] as const;
  const writing = (): ArticleBlock[] =>
    Array.from({ length: 1 + rnd(5) }, (_, i): ArticleBlock => {
      const text = TEXTS[rnd(TEXTS.length)]!;
      const runs = text ? [{ text }] : [];
      const kind = rnd(4);
      return kind === 0
        ? { id: `p${i}`, type: 'paragraph', runs }
        : { id: `l${i}`, type: 'list', list: LISTS[kind - 1]!, level: rnd(2), runs };
    });

  it('match a fresh build for every replace, editable or not', () => {
    let replaced = 0;
    for (let round = 0; round < 1500; round++) {
      let editable = rnd(2) === 0;
      const { plugin, state } = start(writing(), () => editable);
      const tr = replaceContentTr(state, writing(), false);
      if (!tr) continue;
      replaced++;
      if (rnd(3) === 0) editable = !editable;
      const next = state.applyTransaction(tr).state;
      expect(decosOf(shown(next, plugin))).toEqual(decosOf(fresh(next, editable)));
    }
    expect(replaced).toBeGreaterThan(1000);
  });
});
