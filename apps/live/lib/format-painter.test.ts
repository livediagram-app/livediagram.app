import type { ArrowElement, BoxedElement } from '@livediagram/diagram';
import { describe, expect, it } from 'vitest';
import { paintableArrowFields, paintableBoxedFields } from './format-painter';

// Fully-populated source shapes / arrows so the painter has something
// for every field. The painter's whole job is to be specific about
// which fields travel, so the tests are equally specific.

const fullyStyledShape: BoxedElement = {
  id: 'src',
  type: 'shape',
  shape: 'square',
  x: 100,
  y: 200,
  width: 180,
  height: 90,
  aspectLocked: true,
  opacity: 0.7,
  fillColor: '#ff00ff',
  strokeColor: '#003366',
  textColor: '#222222',
  textSize: 'lg',
  textAlignX: 'left',
  textAlignY: 'bottom',
  textBold: true,
  textItalic: true,
  textUnderline: true,
  textStrikethrough: true,
  font: 'caveat',
  padding: 'lg',
  strokeWidth: 'thick',
  strokeStyle: 'dashed',
  borderRadius: 'lg',
  // Identity / content fields the painter must NOT copy.
  label: 'Source label',
  groupId: 'g1',
  locked: true,
};

const fullyStyledArrow: ArrowElement = {
  id: 'arr',
  type: 'arrow',
  from: { kind: 'free', x: 0, y: 0 },
  to: { kind: 'free', x: 100, y: 100 },
  strokeColor: '#0ea5e9',
  strokeWidth: 3,
  strokeStyle: 'dashed',
  opacity: 0.5,
  arrowEnds: 'both',
  arrowheadSize: 'large',
  arrowheadShape: 'triangle-hollow',
  arrowStyle: 'curved',
  label: 'Arrow label',
  locked: true,
};

describe('paintableBoxedFields', () => {
  it('carries every visual styling field from the source', () => {
    const out = paintableBoxedFields(fullyStyledShape);
    expect(out).toEqual({
      width: 180,
      height: 90,
      aspectLocked: true,
      opacity: 0.7,
      fillColor: '#ff00ff',
      strokeColor: '#003366',
      textColor: '#222222',
      textSize: 'lg',
      textAlignX: 'left',
      textAlignY: 'bottom',
      textBold: true,
      textItalic: true,
      textUnderline: true,
      textStrikethrough: true,
      font: 'caveat',
      padding: 'lg',
      strokeWidth: 'thick',
      strokeStyle: 'dashed',
      borderRadius: 'lg',
    });
  });

  it('omits identity, content and position fields so the target keeps its own', () => {
    const out = paintableBoxedFields(fullyStyledShape) as Record<string, unknown>;
    // Identity / position / content stay on the target — the painter
    // must never overwrite them.
    expect(out).not.toHaveProperty('id');
    expect(out).not.toHaveProperty('type');
    expect(out).not.toHaveProperty('shape');
    expect(out).not.toHaveProperty('x');
    expect(out).not.toHaveProperty('y');
    expect(out).not.toHaveProperty('label');
    expect(out).not.toHaveProperty('groupId');
    expect(out).not.toHaveProperty('locked');
  });

  it('drops undefined entries so a target value never gets overwritten with undefined', () => {
    // A bare-default source: nothing customised. The painter
    // shouldn't paint "undefined" anywhere; the result is an empty
    // object (or only carries width / height when the shape was
    // explicitly sized, which all boxed elements have).
    const sparse: BoxedElement = {
      id: 's',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 100,
      height: 50,
    };
    const out = paintableBoxedFields(sparse);
    expect(out).toEqual({ width: 100, height: 50 });
    // Spreading onto a target should be a width / height update only.
    expect(Object.keys(out).sort()).toEqual(['height', 'width']);
  });
});

describe('paintableArrowFields', () => {
  it('carries stroke, width, pattern, opacity and arrowEnds from the source arrow', () => {
    const out = paintableArrowFields(fullyStyledArrow);
    expect(out).toEqual({
      strokeColor: '#0ea5e9',
      strokeWidth: 3,
      strokeStyle: 'dashed',
      opacity: 0.5,
      arrowEnds: 'both',
      arrowheadSize: 'large',
      arrowheadShape: 'triangle-hollow',
      arrowStyle: 'curved',
    });
  });

  it('omits identity, endpoints, label and locked so the target keeps its own', () => {
    const out = paintableArrowFields(fullyStyledArrow) as Record<string, unknown>;
    expect(out).not.toHaveProperty('id');
    expect(out).not.toHaveProperty('type');
    expect(out).not.toHaveProperty('from');
    expect(out).not.toHaveProperty('to');
    expect(out).not.toHaveProperty('label');
    expect(out).not.toHaveProperty('locked');
  });

  it('drops undefined arrow fields so a default arrow paints nothing', () => {
    const bare: ArrowElement = {
      id: 'a',
      type: 'arrow',
      from: { kind: 'free', x: 0, y: 0 },
      to: { kind: 'free', x: 10, y: 10 },
    };
    expect(paintableArrowFields(bare)).toEqual({});
  });
});
