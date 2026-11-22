import { describe, expect, it } from 'vitest';
import { drawnCountWithWriting, hasWriting } from './tab-writing';

// A knowledgebase page is writing with no elements: it counts as something to preview (tab-writing.ts).
const flow = (text: string) => ({
  'art-1': { blocks: [{ id: 't', type: 'paragraph', style: 'title', runs: [{ text }] }] },
});

describe('hasWriting and drawnCountWithWriting', () => {
  it('counts a page of words, never an empty or unreadable one', () => {
    expect(hasWriting({ articles: flow('Start Here') })).toBe(true);
    expect(hasWriting({ articles: flow('  ') })).toBe(false);
    expect(hasWriting({})).toBe(false);
    expect(hasWriting({ articles: { a: null, b: { blocks: 'x' } } })).toBe(false);
    expect(drawnCountWithWriting({ elements: [], articles: flow('Hi') })).toBe(1);
    expect(drawnCountWithWriting({ elements: [{}, {}] })).toBe(2);
    expect(drawnCountWithWriting({ elements: [] })).toBe(0);
  });
});
