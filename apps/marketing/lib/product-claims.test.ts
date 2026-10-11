import { describe, expect, it } from 'vitest';

import { COMPETITOR_LOOK } from '@/components/compare/competitor-look';

import { ALTERNATIVES } from './alternatives';
import { FAQ_CATEGORIES, faqAnswerText } from './faq-content';
import { LANDING_SECTIONS } from './landing-content';

// Claims marketing once made that the product has since outgrown or never matched. Each phrasing
// here was live copy, found false against the product; the test keeps it from coming back on any
// page (docs/specs/019-marketing/comparison-pages.md "Honesty rules").
const FALSE_CLAIMS: { pattern: RegExp; why: string }[] = [
  {
    pattern: /read-only,? (?:live-updating )?iframe|read-only iframe embed for any share link/i,
    why: 'an editor link embeds an editable canvas (docs/specs/013-workspace/embeds.md)',
  },
  {
    pattern: /markdown[^.]*on a new tab/i,
    why: 'Markdown import replaces the current tab (docs/specs/020-import-export/markdown-import.md)',
  },
  {
    pattern: /no Figma integration/i,
    why: 'a Figma link embeds live on the canvas (the Embed element)',
  },
  {
    pattern: /as large as it needs to be|no limits on documents/i,
    why: 'a tab is capped at 10,000 elements; only plan limits are absent',
  },
  {
    pattern: /export any tab[^.]*mermaid/i,
    why: 'Illustrate tabs export PDF, PNG, SVG and JSON only',
  },
  {
    pattern: /live state of every part of the service/i,
    why: 'the status page is a static snapshot, not a live probe',
  },
  {
    pattern: /nothing is sent to a server/i,
    why: 'imported images go through the image upload pipeline',
  },
];

const copy: { where: string; text: string }[] = [
  ...ALTERNATIVES.map((a) => ({ where: `alternatives/${a.slug}`, text: JSON.stringify(a) })),
  ...Object.entries(COMPETITOR_LOOK).map(([slug, look]) => ({
    where: `competitor-look/${slug}`,
    text: look.highlights.join(' '),
  })),
  ...FAQ_CATEGORIES.flatMap((c) =>
    c.items.map((i) => ({ where: `faq: ${i.q}`, text: faqAnswerText(i) })),
  ),
  ...LANDING_SECTIONS.flatMap((s) =>
    s.items.map((i) => ({ where: `landing/${s.id}: ${i.title}`, text: i.description })),
  ),
];

describe('product claims in marketing copy', () => {
  it('reads every page it guards', () => {
    expect(copy.length).toBeGreaterThan(50);
  });

  for (const { pattern, why } of FALSE_CLAIMS) {
    it(`never claims ${pattern.source}: ${why}`, () => {
      const hits = copy.filter((c) => pattern.test(c.text)).map((c) => c.where);
      expect(hits).toEqual([]);
    });
  }
});
