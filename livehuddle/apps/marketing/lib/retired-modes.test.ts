import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

// livehuddle is Workshop alone (docs/specs/002-project-scope/v1-scope.md): Diagram and Draw modes stayed with
// livediagram, Plan mode went to liveplanner and Pages mode to livedocuments, so the marketing copy must not offer
// any of them as livehuddle's own. The forked copy still did ("to Plan when the ideas become cards on a board",
// "pressure-sensitive markers in Draw mode") after each had gone. The site never launched under the old feature
// categories, so it has no redirects for them.
describe('marketing copy', () => {
  const COPY_FILES = ['alternatives.ts', 'faq-content.tsx', 'landing-content.tsx'];
  const RETIRED_MODE_CLAIMS = [
    /\bPlan mode\b/,
    /\bto Plan\b/,
    /\bPlan tab\b/,
    /\bWIP limits?\b/,
    /\bPages mode\b/,
    /\bIllustrate mode\b/,
    /\ba Sheet\b/,
    /\bDiagram mode\b/,
    /\bDraw mode\b/,
    /\bpressure-sensitive\b/i,
    /\bEvent Storming\b/,
    /\bslide deck\b/i,
    // Dot voting left livehuddle too (docs/specs/002-project-scope/not-in-livehuddle.md).
    /\bdot[- ]?vot(e|es|ing)\b/i,
  ];

  it.each(COPY_FILES)('%s offers no retired mode as livehuddle’s', (file) => {
    const source = readFileSync(fileURLToPath(new URL(`./${file}`, import.meta.url)), 'utf8');
    expect(RETIRED_MODE_CLAIMS.filter((claim) => claim.test(source)).map(String)).toEqual([]);
  });
});
