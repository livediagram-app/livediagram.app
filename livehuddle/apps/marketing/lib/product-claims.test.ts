import { describe, expect, it } from 'vitest';

import { EDITOR_MODES, editorModeLabel } from '@livehuddle/document';

import { COMPARISONS } from './alternatives';
import { faqAnswerText } from '@liveworkspace/marketing-site/lib/faq';
import { FAQ_CATEGORIES } from './faq-content';
import { LANDING_SECTIONS } from './landing-content';

// Claims marketing once made that the product has since outgrown or never matched. Each phrasing
// here was live copy, found false against the product; the test keeps it from coming back on any
// page: the landing page, the FAQ, and every comparison and its card (packages/comparisons/README.md
// "Golden rule").
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
    pattern: /export any tab[^.]*(?:mermaid|excalidraw)/i,
    why: 'a tab exports JSON, Markdown, PNG, SVG and PDF; Mermaid and Excalidraw left livehuddle (not-in-livehuddle.md "Imports from other tools")',
  },
  {
    pattern: /any tab (?:out )?as[^.]*(?:mermaid|excalidraw)/i,
    why: 'a tab exports JSON, Markdown, PNG, SVG and PDF; Mermaid and Excalidraw left livehuddle',
  },
  {
    pattern: /import[^.]*(?:excalidraw|mermaid|draw\.io|diagrams\.net)/i,
    why: 'livehuddle imports only its own tab JSON (not-in-livehuddle.md "Imports from other tools")',
  },
  {
    pattern: /undo never reaches|only rewinds your own changes, never/i,
    why: 'undo puts back an element you both changed as you had it (help: canvas/undo)',
  },
  {
    pattern: /builds onto the current tab/i,
    why: 'Markdown import replaces the current tab, it does not add to it',
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
    pattern: /AI assistance|AI panel|ask and clean|clean mode|assistant in the editor/i,
    why: 'the editor has no AI assistant of its own',
  },
  {
    pattern:
      /no voice or video|voice and video calls[^.]*being built|switched off in production|not switched on at livehuddle|usual call (?:alongside|beside|open)/i,
    why: 'proximity voice, cameras and screen shares are on at livehuddle.app (docs/specs/012-collaboration/proximity-audio.md "Turning calls on")',
  },
  {
    pattern: /\bMCP\b|command[- ]line|\bCLI\b|Build with AI|mcp\.livehuddle/i,
    why: 'livehuddle has no MCP server, CLI or Build with AI page (docs/specs/002-project-scope/not-in-livehuddle.md)',
  },
];

const copy: { where: string; text: string }[] = [
  ...COMPARISONS.alternatives.map((a) => ({
    where: `alternatives/${a.slug}`,
    text: JSON.stringify(a),
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
    ...COMPARISONS.alternatives.flatMap((a) =>
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
