import { EDITOR_MODES, editorModeLabel } from '@livediagram/document';
import type { SiteId } from '@liveworkspace/sites';
import { describe, expect, it } from 'vitest';
import { COMPETITOR_LOOK } from './competitor-look';
import { ALTERNATIVES } from './index';

// Claims the comparisons once made that an app has since outgrown or never matched, app by app
// (liveworkspace/docs/comparison-pages.md "Golden rule"). Each phrasing here was live copy, found
// false against that app; the test keeps it from coming back on any comparison that app answers.
// Each app's own marketing site keeps the same list for its FAQ and landing page.
const FALSE_CLAIMS: Partial<Record<SiteId, { pattern: RegExp; why: string }[]>> = {
  'livediagram.app': [
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
      why: 'Pages tabs export PDF, PNG, SVG and JSON only',
    },
    {
      pattern: /any tab (?:out )?as[^.]*(?:markdown|excalidraw)/i,
      why: 'Pages tabs export PDF, PNG, SVG and JSON only',
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
  ],
  'liveplanner.app': [
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
      why: 'projects save to the server; only a This Browser project stays local',
    },
  ],
  'livedocuments.app': [
    {
      pattern: /read-only,? (?:live-updating )?iframe|read-only iframe embed for any share link/i,
      why: 'an editor link embeds an editable canvas (docs/specs/013-workspace/embeds.md)',
    },
    {
      pattern: /markdown[^.]*on a new tab/i,
      why: 'Markdown import replaces the current tab (docs/specs/020-import-export/markdown-import.md)',
    },
    {
      pattern:
        /imports? (?:a |an |your )?(?:mermaid|excalidraw|draw\.io|\.drawio|drawio|microsoft whiteboard)|(?:excalidraw|draw\.io|drawio|whiteboard) import|\.excalidraw in|paste an excalidraw/i,
      why: 'the editor imports a livedocuments JSON export and a Markdown document (as an article) only (help: tabs/import-tabs)',
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
      pattern: /AI assistance|AI (?:key|panel)|ask and clean|clean mode|assistant in the editor/i,
      why: 'the editor has no AI assistant of its own; AI tools connect over MCP (docs/specs/019-marketing/build-with-ai.md)',
    },
  ],
  'livedesign.app': [
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
  ],
};

const copyOf = (app: SiteId) =>
  ALTERNATIVES.filter((a) => a.apps.includes(app)).flatMap((a) => [
    { where: `alternatives/${a.slug}`, text: JSON.stringify(a) },
    { where: `competitor-look/${a.slug}`, text: COMPETITOR_LOOK[a.slug]?.highlights.join(' ') ?? '' },
  ]);

describe('product claims on the comparisons', () => {
  for (const [app, claims] of Object.entries(FALSE_CLAIMS) as [SiteId, { pattern: RegExp; why: string }[]][]) {
    describe(app, () => {
      const copy = copyOf(app);
      it('reads every comparison it guards', () => {
        expect(copy.length).toBeGreaterThan(0);
      });
      for (const { pattern, why } of claims) {
        it(`never claims ${pattern.source}: ${why}`, () => {
          expect(copy.filter((c) => pattern.test(c.text)).map((c) => c.where)).toEqual([]);
        });
      }
    });
  }
});

// A sentence that walks through livediagram's modes lists them in the editor's own order, the order
// its mode switch shows.
describe("livediagram's mode lists", () => {
  const labels = EDITOR_MODES.map(editorModeLabel);
  // Every string on its own, so one field's sentence never runs into the next field's.
  const strings = (v: unknown): string[] =>
    typeof v === 'string'
      ? [v]
      : v && typeof v === 'object'
        ? Object.values(v).flatMap(strings)
        : [];
  it('name the modes in the editor order', () => {
    const wrong = ALTERNATIVES.filter((a) => a.apps.includes('livediagram.app')).flatMap((alt) =>
      strings(alt)
        .flatMap((text) => text.split(/(?<=[.!?])\s+/))
        .filter((sentence) => {
          const found = labels
            .map((label) => sentence.search(new RegExp(`\\b${label}\\b`)))
            .filter((at) => at >= 0);
          return found.length >= 4 && found.some((at, i) => i > 0 && at < found[i - 1]!);
        })
        .map((sentence) => `${alt.slug}: ${sentence.slice(0, 80)}`),
    );
    expect(wrong).toEqual([]);
  });
});
