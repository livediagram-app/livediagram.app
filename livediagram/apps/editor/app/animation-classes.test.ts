import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { ANIMATION_SET_VALUES, SHAPE_ANIMATIONS, type AnimationSetId } from '@livediagram/document';
import { ANIMATION_CLASS_PREFIX } from '@/lib/animation-classes';

// An animation is applied by building a class name from its stored value. Nothing checks that the
// class exists, so a value added to a set without a matching rule picks cleanly in the UI, saves
// onto the element, syncs to collaborators, and animates nothing. There is no error, and the
// element still looks fine at rest, so it reads as "that one is subtle" rather than as a bug.
//
// Each set's classes live in its own stylesheet (docs/specs/028-animation/element-animations.md);
// the text-native silhouette classes for legacy values stay in canvas-motion.css.
const read = (name: string) => {
  const url = new URL(`./${name}`, import.meta.url);
  return existsSync(fileURLToPath(url)) ? readFileSync(fileURLToPath(url), 'utf8') : '';
};
const SHEET: Record<AnimationSetId, string> = {
  shape: 'motion-shape.css',
  text: 'motion-text.css',
  sticky: 'motion-sticky.css',
  drawing: 'motion-drawing.css',
  media: 'motion-media.css',
  table: 'motion-table.css',
};
// The values a set draws with the Shape set's classes (a note and a table are rectangles).
const SHARED: Partial<Record<AnimationSetId, readonly string[]>> = {
  sticky: ['pulse', 'glow', 'highlight'],
  table: ['pulse', 'glow'],
};

// Structural classes that share a prefix but name no animation (the Shape set's child layer, the
// units and words of split text, a table's cells, a drawing's masks, lights and pen marker).
const STRUCTURAL = new Set([
  'layer',
  'unit',
  'word',
  'cell',
  'reveal',
  'fill',
  'dashmask',
  'run',
  'tail',
  'head',
  'pen',
]);

const classesIn = (css: string, prefix: string) =>
  new Set(
    [...css.matchAll(new RegExp(`\\.${prefix}([a-z]+)\\b`, 'g'))]
      .map((m) => m[1]!)
      .filter((n) => !STRUCTURAL.has(n)),
  );

const reducedBlock = (css: string) =>
  [...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)]
    .map((m) => m[1])
    .join('\n');

describe('every animation has the CSS its class name promises', () => {
  it('reads the stylesheets (guard against this test going blind)', () => {
    expect(read('motion-shape.css').length).toBeGreaterThan(5_000);
    expect(SHAPE_ANIMATIONS.length).toBe(15);
  });

  for (const set of Object.keys(SHEET) as AnimationSetId[]) {
    const prefix = ANIMATION_CLASS_PREFIX[set];
    const css = read(SHEET[set]);
    const own = ANIMATION_SET_VALUES[set].filter((v) => !SHARED[set]?.includes(v));

    it(`gives every ${set} value a .${prefix}<name> rule in ${SHEET[set]}`, () => {
      const classes = classesIn(css, prefix);
      expect(own.filter((v) => !classes.has(v))).toEqual([]);
    });

    it(`carries no .${prefix}<name> rule in ${SHEET[set]} that no ${set} value selects`, () => {
      const orphaned = [...classesIn(css, prefix)].filter((n) => !own.includes(n));
      expect(orphaned.sort()).toEqual([]);
    });

    it(`stops every ${set} animation under reduced motion`, () => {
      const stopped = classesIn(reducedBlock(css), prefix);
      expect(own.filter((v) => !stopped.has(v) && css.includes(`.${prefix}${v}`))).toEqual([]);
    });
  }

  it('keeps the legacy text-native variants to Shape values', () => {
    const legacy = classesIn(read('canvas-motion.css'), 'lvd-anim-text-');
    expect([...legacy].filter((n) => !(SHAPE_ANIMATIONS as readonly string[]).includes(n))).toEqual(
      [],
    );
    expect(legacy.size).toBeGreaterThan(0);
  });
});
