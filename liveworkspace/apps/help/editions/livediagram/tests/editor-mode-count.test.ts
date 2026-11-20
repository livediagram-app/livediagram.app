import { describe, expect, it } from 'vitest';
import { scopedArticleSources } from '@/lib/testing/scoped-articles';
import { BLANK_TEMPLATE_FOR_MODE } from '@livediagram/templates';

// An article that counts the editor modes must count the ones there are. Plan, Pages and Illustrate left, and the
// Draw mode article's figure still said "the five modes" with three in the switch it drew. Every editor mode has a
// blank template, so that table's keys are the modes.
const WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
const modeCount = Object.keys(BLANK_TEMPLATE_FOR_MODE).length;

// The articles this app's help shows, each without the other apps' notes (lib/testing/scoped-articles.ts).
const articles = scopedArticleSources();

describe('help articles counting the editor modes', () => {
  it('finds the articles and the modes', () => {
    expect(articles.length).toBeGreaterThan(200);
    expect(modeCount).toBeGreaterThan(1);
  });

  it('give the number there is', () => {
    const wrong = articles.flatMap(({ file, source }) =>
      [...source.matchAll(/\b(\w+) (?:editor )?modes\b/gi)]
        .filter((m) => WORDS.includes(m[1]!.toLowerCase()))
        .filter((m) => WORDS.indexOf(m[1]!.toLowerCase()) + 1 !== modeCount)
        .map((m) => `${file}: ${m[0]}`),
    );
    expect(wrong).toEqual([]);
  });
});
