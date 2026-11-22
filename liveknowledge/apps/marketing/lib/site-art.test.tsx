import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { LANDING_SECTIONS } from './landing-content';

// The site's art (docs/specs/019-marketing/marketing-site.md "Feature sections" and "Tone and brand"): every
// section is illustrated, each drawing is drawn once, and the site is lime, with one amber cube.
const ROOT = fileURLToPath(new URL('..', import.meta.url));

function sources(dir: string): string[] {
  return readdirSync(join(ROOT, dir), { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? sources(join(dir, e.name))
      : /\.(tsx?|css)$/.test(e.name) && !/\.test\./.test(e.name)
        ? [join(dir, e.name)]
        : [],
  );
}

describe('the feature art', () => {
  it.each(LANDING_SECTIONS.map((s) => [s.id, s] as const))('%s is drawn', (_id, section) => {
    const html = renderToStaticMarkup(<>{section.art}</>);
    // A real drawing, not an empty frame: marks, and words on them.
    expect((html.match(/<(?:rect|path|circle|polygon)\b/g) ?? []).length).toBeGreaterThan(10);
    expect(html).toMatch(/>[A-Z][a-z]+/);
    // Decorative, and resting while off screen.
    expect(html).toMatch(/^<div aria-hidden="true" class="[^"]*\[content-visibility:auto\]/);
    // Never a screenshot.
    expect(html).not.toMatch(/<img|<picture|\.png|\.jpe?g|\.webp/);
  });

  it('gives every section a different drawing', () => {
    const drawn = LANDING_SECTIONS.map((s) => renderToStaticMarkup(<>{s.art}</>));
    expect(new Set(drawn).size).toBe(drawn.length);
  });

  it('names the five other apps with the shared brand component, each once', () => {
    const html = renderToStaticMarkup(
      <>{LANDING_SECTIONS.find((s) => s.id === 'workspace')!.art}</>,
    );
    const words = [...html.matchAll(/data-logotype=""[^>]*>(.*?)<\/span>\s*<\/span>/gs)].length;
    expect(words).toBeGreaterThanOrEqual(5);
    for (const word of ['diagram', 'planner', 'documents', 'design', 'huddle']) {
      expect(html, word).toContain(word);
    }
  });

  // The largest is the workspace's: six logos from the shared brand component, each its own small SVG.
  it('keeps each drawing small enough to ship inline (under 32 KB of markup)', () => {
    for (const s of LANDING_SECTIONS) {
      expect(renderToStaticMarkup(<>{s.art}</>).length, s.id).toBeLessThan(32_000);
    }
  });
});

// "No amber left": the fork's brand was amber. The one amber on the site is the cube that stands for
// livedocuments in the hero's drawing.
describe('the site is lime', () => {
  const AMBER = /amber|#f59e0b|#d97706|#a34a0c|#fbbf24/i;
  const AMBER_CUBE = 'components/HeroIllustration.tsx';

  it('has no amber outside the hero’s livedocuments cube', () => {
    const hits = ['app', 'components', 'lib']
      .flatMap(sources)
      .filter((f) => f !== AMBER_CUBE)
      .flatMap((f) =>
        readFileSync(join(ROOT, f), 'utf8')
          .split('\n')
          .flatMap((line, i) => (AMBER.test(line) ? [`${f}:${i + 1}`] : [])),
      );
    expect(hits).toEqual([]);
  });

  it('keeps that cube: three amber faces, in a file that says whose it is', () => {
    const hero = readFileSync(join(ROOT, AMBER_CUBE), 'utf8');
    expect(hero.match(/fill-amber-\d00/g)).toHaveLength(3);
    expect(hero).toMatch(/amber cube\s+\/\/ is livedocuments|amber cube is livedocuments/);
  });
});
