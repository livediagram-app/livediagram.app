import { describe, expect, it } from 'vitest';

import { EDITOR_MODES, editorModeLabel } from '@livedesign/design';

import { FAQ_CATEGORIES, faqAnswerText } from './faq-content';
import { LANDING_SECTIONS } from './landing-content';

// Claims marketing once made that the product has since outgrown or never matched. Each phrasing
// here was live copy, found false against the product; the test keeps it from coming back on any
// page. The comparisons on liveworkspace.app keep the same list for this app
// (liveworkspace/apps/site/lib/alternatives/product-claims.test.ts).
const FALSE_CLAIMS: { pattern: RegExp; why: string }[] = [
  {
    pattern: /read-only,? (?:live-updating )?iframe|read-only iframe embed for any share link/i,
    why: 'an editor link embeds an editable canvas (docs/specs/013-workspace/embeds.md)',
  },
  {
    pattern: /imports? (?:a |your )?markdown|markdown (?:outline )?import/i,
    why: 'the editor imports a livedesign JSON export only (help: tabs/import-tabs)',
  },
  {
    pattern:
      /imports? (?:a |an |your )?(?:mermaid|excalidraw|draw\.io|\.drawio|drawio|microsoft whiteboard)|(?:excalidraw|draw\.io|drawio|whiteboard) import|\.excalidraw in|paste an excalidraw/i,
    why: 'the editor imports a livedesign JSON export only (help: tabs/import-tabs)',
  },
  {
    pattern: /no Figma integration/i,
    why: 'a Figma link embeds live on the canvas (the Embed element)',
  },
  {
    pattern: /as large as it needs to be|no limits on designs/i,
    why: 'a tab is capped at 10,000 elements; only plan limits are absent',
  },
  {
    pattern: /export any tab[^.]*mermaid/i,
    why: 'Pages tabs export PDF, PNG, SVG and JSON only',
  },
  {
    pattern:
      /any tab (?:out )?as[^.]*(?:markdown|excalidraw)|\.excalidraw (?:file|scene)? ?out|(?:as|to) an? \.?excalidraw (?:file|scene)/i,
    why: 'the editor exports PDF, PNG, SVG and JSON only',
  },
  {
    pattern: /undo never reaches|only rewinds your own changes, never/i,
    why: 'undo puts back an element you both changed as you had it (help: canvas/undo)',
  },
  {
    pattern: /live state of every part of the service/i,
    why: 'the status page is a static snapshot, not a live probe',
  },
  {
    pattern: /nothing is sent to a server/i,
    why: 'imported images go through the image upload pipeline',
  },
  {
    pattern: /AI assistance|AI (?:key|panel)|ask and clean|clean mode|assistant in the editor/i,
    why: 'the editor has no AI assistant of its own; AI tools connect over MCP (docs/specs/019-marketing/build-with-ai.md)',
  },
];

const copy: { where: string; text: string }[] = [
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
  const fields = copy;
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
