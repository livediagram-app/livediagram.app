import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { BLANK_TEMPLATE_FOR_MODE } from '@livehuddle/templates';

// An article that counts the editor modes must count the ones there are. Plan, Pages and Illustrate left, and the
// Draw mode article's figure still said "the five modes" with three in the switch it drew. Every editor mode has a
// blank template, so that table's keys are the modes.
const APP_DIR = fileURLToPath(new URL('../app', import.meta.url));
const WORDS = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
const modeCount = Object.keys(BLANK_TEMPLATE_FOR_MODE).length;

const articles = readdirSync(APP_DIR, { recursive: true })
  .map((p) => String(p).replaceAll('\\', '/'))
  .filter((p) => p.endsWith('/page.mdx'));

describe('help articles counting the editor modes', () => {
  it('finds the articles and the modes', () => {
    expect(articles.length).toBeGreaterThan(200);
    expect(modeCount).toBeGreaterThan(1);
  });

  it('give the number there is', () => {
    const wrong = articles.flatMap((file) =>
      [...readFileSync(`${APP_DIR}/${file}`, 'utf8').matchAll(/\b(\w+) (?:editor )?modes\b/gi)]
        .filter((m) => WORDS.includes(m[1]!.toLowerCase()))
        .filter((m) => WORDS.indexOf(m[1]!.toLowerCase()) + 1 !== modeCount)
        .map((m) => `${file}: ${m[0]}`),
    );
    expect(wrong).toEqual([]);
  });
});
