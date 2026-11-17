import { describe, expect, it } from 'vitest';
import { articleSummaries, readabilityWords } from './pages-summary';
import type { PagesTab } from './pages-summary';

// docs/specs/024-agents/pages-for-agents.md "How easily it reads": an article summary carries the editor's Word Count
// figures, and the pages view says them in words.
describe('article readability for agents', () => {
  it("carries the Word Count's figures, the level in the line's words", () => {
    const long = `The plan for the team ${'and the work '.repeat(10)}ends here.`;
    const tab = {
      elements: [],
      pages: [{ id: 'p', orientation: 'portrait', kind: 'article', flow: 'f' }],
      articles: {
        f: {
          blocks: [
            { id: '1', type: 'paragraph', runs: [{ text: 'The cat sat on the mat.' }] },
            { id: '2', type: 'paragraph', runs: [{ text: long }] },
          ],
        },
      },
    } as unknown as PagesTab;
    const [a] = articleSummaries(tab);
    expect(a!.readability).toMatchObject({
      readingMinutes: 1,
      sentences: 2,
      longSentences: 1,
      wordsPerSentence: 21.5,
    });
    expect(a!.readability.level).toEqual(expect.any(String));
  });

  it('says the reading time, the level and the long sentences, each only when there is one', () => {
    const base = { sentences: 3, wordsPerSentence: 12, ease: 72 };
    expect(
      readabilityWords({ ...base, readingMinutes: 4, longSentences: 2, level: 'Easy to read' }),
    ).toBe('4 min read · Easy to read · 2 long sentences');
    expect(readabilityWords({ ...base, readingMinutes: 1, longSentences: 1, level: null })).toBe(
      '1 min read · 1 long sentence',
    );
    expect(
      readabilityWords({ ...base, readingMinutes: 0, sentences: 0, longSentences: 0, level: null }),
    ).toBe('');
  });
});
