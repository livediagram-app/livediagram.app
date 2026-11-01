import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { LANDING_SECTION_IDS } from './landing-content';

// The retired feature category pages (docs/specs/019-marketing/marketing-site.md "Feature category
// pages") redirect permanently from public/_redirects. Every one must land on a page that exists,
// and a live category must never be redirected away from itself.
const RETIRED = [
  'simple',
  'content',
  'express',
  'assist',
  'customise',
  'refine',
  'tabs',
  'motion',
  'present',
  'reliability',
  'connect',
  'foundations',
  'infographics',
  'slides',
  'documents',
  'plan',
  'sheets',
  'forms',
];

const rules = readFileSync(fileURLToPath(new URL('../public/_redirects', import.meta.url)), 'utf8')
  .split('\n')
  .filter((line) => line.trim() && !line.startsWith('#'))
  .map((line) => line.trim().split(/\s+/));

describe('retired feature pages', () => {
  it('redirects every retired category, with and without a trailing slash, permanently', () => {
    for (const id of RETIRED) {
      for (const from of [`/features/${id}`, `/features/${id}/`]) {
        const rule = rules.find(([source]) => source === from);
        expect(rule, from).toBeDefined();
        expect(rule![2]).toBe('301');
      }
    }
  });

  it('sends each one to a live page', () => {
    // Pages mode's own categories went to livedocuments, and Plan mode's to liveplanner, the apps that now
    // make them, at www as the sites registry names them.
    const live = new Set([
      '/',
      'https://www.livedocuments.app/',
      'https://www.liveplanner.app/',
      ...LANDING_SECTION_IDS.map((id) => `/features/${id}`),
    ]);
    for (const [from, to] of rules) {
      if (from!.startsWith('/features/')) expect(live.has(to!), to).toBe(true);
    }
  });

  it('never redirects a live category', () => {
    const sources = new Set(rules.map(([source]) => source!.replace(/\/$/, '')));
    for (const id of LANDING_SECTION_IDS) expect(sources.has(`/features/${id}`)).toBe(false);
  });
});

// Plan mode left for liveplanner and Pages mode for livedocuments, so the marketing copy must not offer them as
// livehuddle's own. The FigJam and XMind comparisons still did ("to Plan when the ideas become cards on a board,
// with a Sheet beside it", "Plan mode turns a tab into a board of cards") weeks after both had gone.
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
  ];

  it.each(COPY_FILES)('%s offers no retired mode as livehuddle’s', (file) => {
    const source = readFileSync(fileURLToPath(new URL(`./${file}`, import.meta.url)), 'utf8');
    expect(RETIRED_MODE_CLAIMS.filter((claim) => claim.test(source)).map(String)).toEqual([]);
  });
});
