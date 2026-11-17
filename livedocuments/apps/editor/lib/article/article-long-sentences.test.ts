import { describe, expect, it } from 'vitest';
import { EditorState, TextSelection } from 'prosemirror-state';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { articleFromMarkdown, type ArticleBlock } from '@livedocuments/document';
import { blocksToDoc } from './article-convert';
import {
  longSentenceRanges,
  nextLongSentence,
  selectNextLongSentence,
} from './article-long-sentences';

// docs/specs/007-editor/article-pages.md "Word Count": picking the line selects the next sentence over 30 words.
const LONG_A = `Alpha ${'word '.repeat(30)}end.`;
const LONG_B = `Beta ${'word '.repeat(31)}end.`;
const stateOf = (markdown: string) => {
  const read = articleFromMarkdown(markdown);
  if (!('blocks' in read)) throw new Error('refused');
  return EditorState.create({ doc: blocksToDoc(read.blocks) });
};
const selected = (state: EditorState) =>
  state.doc.textBetween(state.selection.from, state.selection.to);

describe('longSentenceRanges', () => {
  it('finds each sentence over 30 words in the prose, as positions, never in code or a table', () => {
    const state = stateOf(
      `# Short title\n\nA short one. ${LONG_A} Then short.\n\n- ${LONG_B}\n\n\`\`\`\n${LONG_A}\n\`\`\`\n\n| ${LONG_A} | b |\n|---|---|\n| c | d |`,
    );
    const ranges = longSentenceRanges(state.doc);
    expect(ranges).toHaveLength(2);
    expect(state.doc.textBetween(ranges[0]!.from, ranges[0]!.to)).toBe(LONG_A);
    expect(state.doc.textBetween(ranges[1]!.from, ranges[1]!.to)).toBe(LONG_B);
  });

  it("keeps positions true past a footnote's marker", () => {
    const state = stateOf(`Lead[^1] in. ${LONG_A}\n\n[^1]: the note`);
    const [range] = longSentenceRanges(state.doc);
    expect(state.doc.textBetween(range!.from, range!.to)).toBe(LONG_A);
  });
});

describe('nextLongSentence', () => {
  const ranges = [
    { from: 10, to: 20 },
    { from: 30, to: 40 },
  ];
  it('takes the next after the caret, or after the selection start, then wraps', () => {
    expect(nextLongSentence(ranges, 10, true)).toEqual(ranges[0]);
    expect(nextLongSentence(ranges, 10, false)).toEqual(ranges[1]);
    expect(nextLongSentence(ranges, 35, true)).toEqual(ranges[0]);
    expect(nextLongSentence([], 1, true)).toBeNull();
  });
});

describe('selectNextLongSentence', () => {
  it('selects each long sentence in turn, then the first again', () => {
    let state = stateOf(`${LONG_A}\n\nShort.\n\n${LONG_B}`);
    const step = () => {
      let ran = false;
      selectNextLongSentence(state, (tr) => {
        ran = true;
        state = state.apply(tr);
      });
      return ran;
    };
    expect(step()).toBe(true);
    expect(selected(state)).toBe(LONG_A);
    step();
    expect(selected(state)).toBe(LONG_B);
    step();
    expect(selected(state)).toBe(LONG_A);
  });

  it('does nothing with no long sentence', () => {
    const state = stateOf('Short. Also short.');
    expect(selectNextLongSentence(state)).toBe(false);
    expect(
      selectNextLongSentence(state.apply(state.tr.setSelection(TextSelection.atEnd(state.doc)))),
    ).toBe(false);
  });

  it('walks a long article well inside a frame, on the pick only', () => {
    const blocks: ArticleBlock[] = Array.from({ length: 2000 }, (_, i) => ({
      id: `b${i}`,
      type: 'paragraph',
      runs: [{ text: i === 1999 ? LONG_A : 'word '.repeat(50).trim() }],
    }));
    const state = EditorState.create({ doc: blocksToDoc(blocks) });
    let found = 0;
    const spent = cpuMsOf(() => {
      found = longSentenceRanges(state.doc).length;
    });
    // Each 50-word paragraph without a stop is one sentence over 30 words, the last too.
    expect(found).toBe(2000);
    expect(spent).toBeLessThan(cpuBudgetMs(80));
  });
});
