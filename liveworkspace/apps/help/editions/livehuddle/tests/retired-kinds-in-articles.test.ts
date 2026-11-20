import { readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { APP_DIR, scopedArticleSources } from '@/lib/testing/scoped-articles';

// livehuddle dropped the diagram elements (docs/specs/002-project-scope/not-in-livehuddle.md "What leaves"), so no
// help article may list one as something you can use. The Radius control went with the shapes it rounded. The
// articles are the ones livehuddle's help shows, each read without the other apps' notes, where those kinds still
// belong (lib/testing/scoped-articles.ts).

const RETIRED: [string, RegExp][] = [
  ['a chart', /\b(?:pie|bar|line|area|donut|radar) charts?\b/i],
  ['a checklist element', /\b(?:checklists|progress bars?|ratings?)\b/i],
  ['a code block', /\bcode blocks?\b/i],
  ['a diagram shape', /\b(?:diamond|stadium)s?\b/i],
  ['the Radius control', /\bRadius\b/],
  ['Accent Edge', /Accent Edge/],
  ['a quiz', /\bquiz(?:zes)?\b/i],
  ['a web component', /\bweb components?\b/i],
];

// The developer reference names the kinds the API refuses; that is the one place a retired kind belongs.
const REFUSAL_REFERENCE = 'developers/working-with-documents/edit-operations/page.mdx';

describe('livehuddle help articles', () => {
  const files = scopedArticleSources().filter(({ file }) => file !== REFUSAL_REFERENCE);

  it('reads the articles (guard against this test going blind)', () => {
    expect(files.length).toBeGreaterThan(50);
    expect(readdirSync(`${APP_DIR}/canvas`)).toContain('colours-borders-opacity');
  });

  it.each(RETIRED)('never mention %s', (_name, pattern) => {
    const hits = files.flatMap(({ file, source }) =>
      source
        .split('\n')
        .filter((line) => pattern.test(line))
        .map((line) => `${file}: ${line.trim().slice(0, 100)}`),
    );
    expect(hits).toEqual([]);
  });
});
