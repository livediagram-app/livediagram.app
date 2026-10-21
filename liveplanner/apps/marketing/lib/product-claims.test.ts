import { describe, expect, it } from 'vitest';

import { EDITOR_MODES, editorModeLabel } from '@liveplanner/document';

import { COMPETITOR_LOOK } from '@/components/compare/competitor-look';

import { ALTERNATIVES } from './alternatives';
import { FAQ_CATEGORIES, faqAnswerText } from './faq-content';
import { LANDING_SECTIONS } from './landing-content';
import { MARKETING_DESCRIPTION, MARKETING_PITCH, MARKETING_TITLE } from './site-copy';

// Claims marketing once made that the product has since outgrown or never matched. Each phrasing
// here was live copy, found false against the product; the test keeps it from coming back on any
// page (docs/specs/019-marketing/comparison-pages.md "Honesty rules").
const FALSE_CLAIMS: { pattern: RegExp; why: string }[] = [
  {
    pattern: /read-only,? (?:live-updating )?iframe|read-only iframe embed for any share link/i,
    why: 'an editor link embeds an editable canvas (docs/specs/013-workspace/embeds.md)',
  },
  {
    pattern:
      /imports? (?:a |an |your )?(?:markdown|mermaid|excalidraw|draw\.io|\.drawio|drawio|microsoft whiteboard)|(?:markdown|excalidraw|draw\.io|drawio|whiteboard) import|\.excalidraw in|paste an excalidraw/i,
    why: 'the editor imports a liveplanner JSON export only (help: tabs/import-tabs)',
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
    why: 'Pages tabs export PDF, PNG, SVG and JSON only',
  },
  {
    pattern:
      /any tab (?:out )?as[^.]*(?:markdown|excalidraw)|\.excalidraw (?:file|scene)? ?out|(?:as|to) an? \.?excalidraw (?:file|scene)/i,
    why: 'the editor exports PNG, SVG, PDF, JSON, Markdown and CSV; Pages tabs PDF, PNG, SVG and JSON only',
  },
  {
    pattern: /undo never reaches|only rewinds your own changes, never/i,
    why: 'undo puts back an element you both changed as you had it (help: canvas/undo)',
  },
  {
    pattern: /builds onto the current tab/i,
    why: 'Import replaces the current tab, it does not add to it',
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

// A sentence that walks through the modes lists them in the editor's own order (Workshop after
// Draw since #548), the order the mode switch shows.
describe('mode lists in marketing copy', () => {
  const labels = EDITOR_MODES.map(editorModeLabel);
  // Every string on its own, so one field's sentence never runs into the next field's.
  const strings = (v: unknown): string[] =>
    typeof v === 'string'
      ? [v]
      : v && typeof v === 'object'
        ? Object.values(v).flatMap(strings)
        : [];
  const fields = [
    ...ALTERNATIVES.flatMap((a) =>
      strings(a).map((text) => ({ where: `alternatives/${a.slug}`, text })),
    ),
    ...copy.filter((c) => !c.where.startsWith('alternatives/')),
  ];
  it('name the modes in the editor order', () => {
    const wrong = fields.flatMap(({ where, text }) =>
      text
        .split(/(?<=[.!?])\s+/)
        .map((sentence) => {
          const found = labels
            .map((label) => ({ label, at: sentence.search(new RegExp(`\\b${label}\\b`)) }))
            .filter((m) => m.at >= 0);
          return { sentence, found };
        })
        .filter(({ found }) => found.length >= 4)
        .filter(({ found }) => found.some((m, i) => i > 0 && m.at < found[i - 1]!.at))
        .map(({ sentence }) => `${where}: ${sentence.slice(0, 80)}`),
    );
    expect(wrong).toEqual([]);
  });
});

// liveplanner is Plan mode alone (docs/specs/019-marketing/marketing-site.md): the landing page and the
// site's own metadata never offer what the product does not carry, and a person's work is a project,
// never a document.
describe('what the landing copy says liveplanner is', () => {
  const own = [
    ...LANDING_SECTIONS.flatMap((s) => [
      {
        where: `landing/${s.id}`,
        text: [s.label, s.title, s.description, s.metaDescription, s.cta].join(' '),
      },
      ...s.items.map((i) => ({
        where: `landing/${s.id}: ${i.title}`,
        text: `${i.title} ${i.description}`,
      })),
    ]),
    {
      where: 'site-copy',
      text: [MARKETING_TITLE, MARKETING_DESCRIPTION, MARKETING_PITCH].join(' '),
    },
  ];
  const DROPPED =
    /\b(?:diagrams?|diagramming|whiteboards?|infographics?|slides?|slide decks?|mind ?maps?|articles?|workshops?|canvas)\b/i;

  it('never offers a mode liveplanner does not carry', () => {
    expect(own.filter((c) => DROPPED.test(c.text)).map((c) => c.where)).toEqual([]);
  });

  it('calls the work a project, never a document', () => {
    expect(own.filter((c) => /\bdocuments?\b/i.test(c.text)).map((c) => c.where)).toEqual([]);
  });
});
