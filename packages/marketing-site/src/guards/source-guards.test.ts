import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { checkOpticalAlignment, formatViolations } from '@liveworkspace/style-guards/optical-guard';
import {
  checkTouchTargets,
  formatTouchTargetViolations,
} from '@liveworkspace/style-guards/touch-target-guard';

import { PRODUCTS, sources, TARGETS } from './targets';

// The marketing sites' source rules, held once over every product's marketing app and the shared pages
// (targets.ts). Each used to be a test copied into all four apps.
const markup = (dirs: string[]) => dirs.filter((d) => d !== 'lib' && d !== 'css');

describe.each(TARGETS)('$name', ({ root, dirs }) => {
  // A glyph in a circle or pill centres its cap band, not its line box
  // (docs/specs/004-interface-design/optical-alignment.md): text goes through text-optical-centre or a primitive.
  it('holds no bare text in a centring circle or pill', () => {
    expect(formatViolations(checkOpticalAlignment({ root }))).toBe('');
  });

  // A touch-target pad is an absolutely positioned ::before, so its host is positioned
  // (docs/specs/004-interface-design/touch-targets.md): a static one let the pad take every tap around it.
  it('positions every control that carries a touch-target pad', () => {
    expect(formatTouchTargetViolations(checkTouchTargets({ root }))).toBe('');
  });

  // In dark, slate-800 (#16202e) is a surface one step off slate-900 (#131b26), not an edge
  // (docs/specs/004-interface-design/color-scheme.md): a slate-900 card outlined in slate-800 showed no
  // edge at all. A card's dark border is slate-700. The hero's editor mocks and the feature-card art are
  // exempt: they draw the editor's own chrome as the editor draws it.
  it('outlines every slate-900 card in slate-700, never the near-invisible slate-800', () => {
    const files = markup(dirs)
      .flatMap((d) => sources(root, d, /\.tsx?$/))
      .filter((f) => !DARK_BORDER_EXEMPT.test(f));
    expect(files.length).toBeGreaterThan(0);
    const faint = files.flatMap((f) =>
      readFileSync(join(root, f), 'utf8')
        .split('\n')
        .flatMap((line, i) => (FAINT_CARD.test(line) ? [`${f}:${i + 1}`] : [])),
    );
    expect(faint).toEqual([]);
  });

  // Marketing's share rail sits beside a max-w-6xl page from xl. A wider max-w-7xl column fills the
  // window there, so its text ran under the rail at 1280px; each one takes RAIL_CLEAR_PADDING
  // (packages/ui/src/share-rail-clearance.ts) instead of its own side padding.
  it('gives every max-w-7xl column the rail-clear padding', () => {
    for (const f of markup(dirs).flatMap((d) => sources(root, d, /\.tsx$/))) {
      const src = readFileSync(join(root, f), 'utf8');
      for (const line of src.split('\n').filter((l) => l.includes('max-w-7xl'))) {
        expect(line, f).toContain('${RAIL_CLEAR_PADDING}');
        expect(line, f).not.toMatch(/\bpx-\d/);
      }
    }
  });

  // Tailwind's stock looping animations (animate-ping, -pulse, -spin, -bounce) run forever and ignore
  // prefers-reduced-motion unless gated. Marketing's own loops settle under reduced motion in their
  // stylesheets; a utility class needs the motion-safe: variant to do the same. The status page's pulse
  // ran for reduced-motion visitors until this test.
  it('gates every looping Tailwind animation on motion-safe:', () => {
    const files = dirs.flatMap((d) => sources(root, d, /\.tsx?$/));
    expect(files.length).toBeGreaterThan(5);
    const bare = files.flatMap((f) =>
      [...readFileSync(join(root, f), 'utf8').matchAll(BARE_LOOP)].map((m) => `${f}: ${m[0]}`),
    );
    expect(bare).toEqual([]);
  });

  // AGENTS.md "No god files": a source file past ~1000 lines is doing too much and must be broken up.
  // Pure data is exempt, however long it grows: the landing copy, the comparison set and the FAQ are
  // flat catalogues. Feature art splits by card family (components/feature-art/*), re-exported by the
  // FeatureArt barrel. The limit is a ratchet: it sits a little above the largest code file and
  // comes down as files split (1000, then 750 after the first October 2026 art split, then 650 after the second).
  it('keeps every code file under the line limit', () => {
    const long = dirs
      .flatMap((d) => sources(root, d, /\.(tsx?|css)$/))
      .filter((f) => !DATA.has(f))
      .map((f) => [f, readFileSync(join(root, f), 'utf8').split('\n').length] as const)
      .filter(([, lines]) => lines > LINE_LIMIT);
    expect(long).toEqual([]);
  });
});

const DARK_BORDER_EXEMPT = /(^|\/)(hero-[^/]*|feature-art\/.*)$/;
// A rounded, bordered slate-900 surface whose dark border is slate-800.
const FAINT_CARD =
  /(?=[^"'`]*\brounded)(?=[^"'`]*\bborder\b)[^"'`]*dark:border-slate-800\b[^"'`]*dark:bg-slate-900\b/;
const BARE_LOOP = /(?<![\w:-])animate-(?:ping|pulse|spin|bounce)\b/g;
const LINE_LIMIT = 650;
const DATA = new Set(['lib/landing-content.tsx', 'lib/alternatives.ts', 'lib/faq-content.tsx']);

describe('the marketing guards', () => {
  it('read every product, and each product has the sources and data files they expect', () => {
    expect(TARGETS.map((t) => t.name)).toEqual([
      ...PRODUCTS.map((p) => `${p} marketing`),
      '@liveworkspace/marketing-site',
    ]);
    for (const { root, dirs } of TARGETS.slice(0, PRODUCTS.length)) {
      const files = dirs.flatMap((d) => sources(root, d, /\.(tsx?|css)$/));
      expect(files.length).toBeGreaterThan(50);
      for (const f of DATA) expect(files).toContain(f);
    }
  });

  it('find at least one max-w-7xl column to hold to the rail rule', () => {
    const wide = TARGETS.flatMap(({ root, dirs }) =>
      markup(dirs)
        .flatMap((d) => sources(root, d, /\.tsx$/))
        .filter((f) => readFileSync(join(root, f), 'utf8').includes('max-w-7xl')),
    );
    expect(wide.length).toBeGreaterThan(0);
  });

  it('catch the faint card pairing they guard against', () => {
    expect(
      FAINT_CARD.test(
        '"rounded-2xl border border-slate-200 dark:border-slate-800 dark:bg-slate-900"',
      ),
    ).toBe(true);
    expect(
      FAINT_CARD.test(
        '"rounded-2xl border border-slate-200 dark:border-slate-700 dark:bg-slate-900"',
      ),
    ).toBe(false);
  });
});
