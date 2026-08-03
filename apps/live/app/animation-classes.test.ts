import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ELEMENT_ANIMATIONS } from '@livediagram/diagram';

// An element's animation is applied by building a class name:
// `lvd-anim-${element.animation}`. Nothing checks that the class exists, so an
// animation added to the union without a matching rule in globals.css picks
// cleanly in the UI, saves onto the element, syncs to collaborators, and
// animates nothing. There is no error, and the element still looks fine at
// rest, so it reads as "that one is subtle" rather than as a bug.
//
// This is not hypothetical for the feature: useBoxedElementAnimation records
// that glow and pulse "did nothing at all" on stickers because the class was
// dropped on the way to a renderer that never ran. Same silence, different
// cause.
const CSS = readFileSync(fileURLToPath(new URL('./globals.css', import.meta.url)), 'utf8');

const boxClasses = new Set(
  [...CSS.matchAll(/^\.lvd-anim-([a-z-]+)/gm)]
    .map((m) => m[1]!)
    .filter((name) => !name.startsWith('text-') && name !== 'sticker-gradient'),
);

// The label-level variants, for the four animations that paint the glyphs
// rather than the box (a standalone text element has no fill or border to
// animate). The hook only ever builds `lvd-anim-text-<a>` for those.
const textClasses = new Set([...CSS.matchAll(/^\.lvd-anim-text-([a-z-]+)/gm)].map((m) => m[1]!));

describe('every animation has the CSS its class name promises', () => {
  it('reads the stylesheet (guard against this test going blind)', () => {
    expect(CSS.length).toBeGreaterThan(10_000);
    expect(ELEMENT_ANIMATIONS.length).toBeGreaterThan(10);
  });

  it('gives every ElementAnimation a .lvd-anim-<name> rule', () => {
    const silent = ELEMENT_ANIMATIONS.filter((a) => !boxClasses.has(a));
    expect(silent).toEqual([]);
  });

  it('carries no .lvd-anim-<name> rule that no animation can select', () => {
    // The mirror: a rule left behind after an animation was renamed or
    // dropped is dead weight in a stylesheet every editor page loads.
    const orphaned = [...boxClasses].filter(
      (name) => !(ELEMENT_ANIMATIONS as readonly string[]).includes(name),
    );
    expect(orphaned.sort()).toEqual([]);
  });

  it('keeps the text variants to real animations', () => {
    // Deliberately a SUBSET check, not parity: only the four silhouette
    // animations (glow / pulse / trace / gradient) need a glyph-level rule,
    // because the transform ones already move the text with the box.
    const strays = [...textClasses].filter(
      (name) => !(ELEMENT_ANIMATIONS as readonly string[]).includes(name),
    );
    expect(strays.sort()).toEqual([]);
    expect(textClasses.size).toBeGreaterThan(0);
  });
});
