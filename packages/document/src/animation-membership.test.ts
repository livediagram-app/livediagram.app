import { describe, expect, it } from 'vitest';
import {
  ANIMATION_SET_VALUES,
  SHAPE_ANIMATIONS,
  SHAPE_MOTIONS,
  animationLabel,
  animationSectionOf,
  shapeAnimationsFor,
  takesShapeMotions,
  animationSetsOf,
  bodyAnimationSetOf,
  carriesWords,
  inAnimationSet,
  isRevealAnimation,
  keptAnimation,
  type Element,
} from './index';
import { createSticky, createText } from './factories';
import { createShape } from './shape-factory';

// Minimal stand-ins for the element types without a factory here.
const of = (type: string, extra: object = {}) =>
  ({ id: type, type, x: 0, y: 0, width: 10, height: 10, ...extra }) as unknown as Element;

describe('bodyAnimationSetOf', () => {
  it.each([
    [createShape('square', 0, 0), 'shape'],
    [createShape('diamond', 0, 0), 'shape'],
    [createShape('sticker', 0, 0), 'shape'],
    [of('annotation'), 'shape'],
    [of('link-card'), 'shape'],
    [createSticky(0, 0), 'sticky'],
    [of('freehand'), 'drawing'],
    [of('image'), 'media'],
    [of('video'), 'media'],
    [of('table'), 'table'],
  ] as const)('%s.type takes %s', (el, set) => {
    expect(bodyAnimationSetOf(el)).toBe(set);
  });

  it('gives a text element no body set: its words are the whole element', () => {
    expect(bodyAnimationSetOf(createText(0, 0))).toBeUndefined();
  });

  it('leaves icons, charts, progress and rating to their own sets', () => {
    for (const kind of ['icon', 'pie-chart', 'progress-bar', 'rating'] as const) {
      expect(bodyAnimationSetOf(createShape(kind, 0, 0))).toBeUndefined();
    }
  });

  it('never gives arrows a body set', () => {
    expect(bodyAnimationSetOf(of('arrow'))).toBeUndefined();
  });
});

describe('carriesWords', () => {
  it('is true for text, stickies, tables and labelled shapes', () => {
    expect(carriesWords(createText(0, 0))).toBe(true);
    expect(carriesWords(createSticky(0, 0))).toBe(true);
    expect(carriesWords(of('table'))).toBe(true);
    expect(carriesWords(createShape('square', 0, 0))).toBe(true);
  });

  it('is false for shapes whose words are art or drawn by the shape', () => {
    for (const kind of ['icon', 'sticker', 'chair', 'pie-chart', 'progress-bar'] as const) {
      expect(carriesWords(createShape(kind, 0, 0))).toBe(false);
    }
  });

  it('is false for drawings, media and arrows', () => {
    for (const t of ['freehand', 'image', 'video', 'arrow']) {
      expect(carriesWords(of(t))).toBe(false);
    }
  });
});

describe('animationSetsOf', () => {
  it('a labelled shape shows Shape and Text', () => {
    expect(animationSetsOf([createShape('square', 0, 0)])).toEqual(['shape', 'text']);
  });

  it('a text element shows Text alone', () => {
    expect(animationSetsOf([createText(0, 0)])).toEqual(['text']);
  });

  it('a mixed selection lists each set once, in menu order', () => {
    const sel = [
      of('table'),
      createText(0, 0),
      of('image'),
      createSticky(0, 0),
      createSticky(0, 0),
    ];
    expect(animationSetsOf(sel)).toEqual(['shape', 'sticky', 'media', 'table', 'text']);
  });

  it('inAnimationSet matches the membership rules', () => {
    expect(inAnimationSet('text', createShape('square', 0, 0))).toBe(true);
    expect(inAnimationSet('shape', createText(0, 0))).toBe(false);
    expect(inAnimationSet('media', of('video'))).toBe(true);
  });
});

// docs/specs/028-animation/element-animations.md "Shape motions".
describe('Shape motions', () => {
  it('are offered beside every set that animates inside its element', () => {
    for (const el of [
      createSticky(0, 0),
      of('freehand'),
      of('image'),
      of('video'),
      of('table'),
      createShape('pie-chart', 0, 0),
      createShape('progress-bar', 0, 0),
      createShape('rating', 0, 0),
      createShape('chevrons', 0, 0),
      createShape('sequence', 0, 0),
    ]) {
      expect(takesShapeMotions(el), el.type).toBe(true);
      expect(inAnimationSet('shape', el), el.type).toBe(true);
      expect(shapeAnimationsFor(el), el.type).toEqual(SHAPE_MOTIONS);
    }
  });

  it('are not offered to icons, text, arrows or the Shape set’s own members', () => {
    for (const el of [createShape('icon', 0, 0), createText(0, 0), of('arrow')]) {
      expect(takesShapeMotions(el)).toBe(false);
      expect(shapeAnimationsFor(el)).toEqual([]);
      expect(inAnimationSet('shape', el)).toBe(false);
    }
    expect(takesShapeMotions(createShape('square', 0, 0))).toBe(false);
    expect(shapeAnimationsFor(createShape('square', 0, 0))).toEqual(SHAPE_ANIMATIONS);
  });

  it('move or fade the element as a whole, never light its outline', () => {
    expect(SHAPE_MOTIONS).toHaveLength(9);
    for (const v of ['pulse', 'glow', 'trace', 'gradient', 'shimmer', 'highlight'])
      expect(SHAPE_MOTIONS).not.toContain(v);
    for (const v of SHAPE_MOTIONS) expect(SHAPE_ANIMATIONS).toContain(v);
  });

  it('show a value in the one section it belongs to', () => {
    expect(animationSectionOf(of('image'), 'bounce')).toBe('shape');
    expect(animationSectionOf(of('image'), 'kenburns')).toBe('media');
    expect(animationSectionOf(createSticky(0, 0), 'pulse')).toBe('sticky');
    // A chart's older Shape value is its Shape section's kept tile; a concept graphic's plays nowhere.
    expect(animationSectionOf(createShape('pie-chart', 0, 0), 'pulse')).toBe('shape');
    expect(animationSectionOf(createShape('chevrons', 0, 0), 'pulse')).toBeUndefined();
    expect(animationSectionOf(createShape('square', 0, 0), 'bounce')).toBe('shape');
    expect(animationSectionOf(of('image'), null)).toBe('media');
  });
});

describe('catalogues', () => {
  it('keeps every value saved before the split in the Shape set', () => {
    expect(SHAPE_ANIMATIONS).toHaveLength(15);
  });

  it('marks reveals per set', () => {
    expect(isRevealAnimation('text', 'typewriter')).toBe(true);
    expect(isRevealAnimation('text', 'wave')).toBe(false);
    expect(isRevealAnimation('table', 'rows')).toBe(true);
    expect(isRevealAnimation('shape', 'pulse')).toBe(false);
  });

  it('lists no value twice within a set', () => {
    for (const values of Object.values(ANIMATION_SET_VALUES)) {
      expect(new Set(values).size).toBe(values.length);
    }
  });

  it('offers a kept tile only for an old Shape value the set does not offer', () => {
    expect(keptAnimation('sticky', 'bounce')).toBe('bounce');
    expect(keptAnimation('sticky', 'pulse')).toBeUndefined();
    expect(keptAnimation('text', 'trace')).toBe('trace');
    expect(keptAnimation('media', 'nonsense')).toBeUndefined();
    expect(keptAnimation('shape', null)).toBeUndefined();
  });

  it('labels values for their tiles', () => {
    expect(animationLabel('kenburns')).toBe('Ken Burns');
    expect(animationLabel('typewriter')).toBe('Typewriter');
  });
});
