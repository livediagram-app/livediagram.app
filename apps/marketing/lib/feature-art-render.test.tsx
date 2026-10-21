import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { LANDING_SECTIONS } from './landing-content';

// The feature-art classes whose CSS sets a transform: in a rule (a reduced-motion reset, say) or
// through the keyframes they run. That CSS transform overrides an SVG transform attribute on the
// same element, so a mirrored or placed mark carrying one would jump (or, settled, lose it).
const CSS_DIR = fileURLToPath(new URL('../app/feature-art/', import.meta.url));
const CSS = readdirSync(CSS_DIR)
  .map((f) => readFileSync(`${CSS_DIR}${f}`, 'utf8'))
  .join('\n');
const MOVING_KEYFRAMES = new Set(
  [...CSS.matchAll(/@keyframes ([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)[^{}]*\}/g)]
    .filter(([, , body]) => /transform\s*:/.test(body!))
    .map(([, name]) => name!),
);
const TRANSFORMED = new Set<string>();
for (const [, selectors, body] of CSS.matchAll(/([^{}@]+)\{([^{}]*)\}/g)) {
  const runs = [...body!.matchAll(/animation(?:-name)?\s*:\s*([\w-]+)/g)].some(([, k]) =>
    MOVING_KEYFRAMES.has(k!),
  );
  if (!/transform\s*:/.test(body!) && !runs) continue;
  for (const [, cls] of selectors!.matchAll(/\.(fa-[\w-]+)/g)) TRANSFORMED.add(cls!);
}

// Every feature card's art renders to a finished, decorative picture in the static export
// (docs/specs/019-marketing/marketing-site.md "Story beats"): hidden from assistive tech, with no
// coordinate or label left NaN or undefined.
describe('feature card art', () => {
  it('finds the transformed classes it guards', () => {
    expect(TRANSFORMED).toContain('fa-f-in');
    expect(TRANSFORMED).not.toContain('fa-a-drain');
  });

  for (const section of LANDING_SECTIONS) {
    for (const item of section.items) {
      it(`${section.id}: ${item.title}`, () => {
        const html = renderToStaticMarkup(<>{item.art}</>);
        expect(html).toMatch(/^<[a-z]+ [^>]*aria-hidden="true"/);
        expect(html).not.toMatch(/NaN|undefined/);
        for (const [tag] of html.matchAll(/<[a-z]+ [^>]*>/g)) {
          const classes = /class="([^"]*)"/.exec(tag)?.[1]?.split(' ') ?? [];
          if (classes.some((c) => TRANSFORMED.has(c))) expect(tag).not.toMatch(/ transform="/);
        }
      });
    }
  }
});
