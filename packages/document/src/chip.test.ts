import { describe, expect, it } from 'vitest';
import {
  badgeSize,
  chipColours,
  chipLookOf,
  createShape,
  duplicateElements,
  isValidElement,
  nextStepNumber,
  renumberSteps,
  svgBoxed,
  withChipLook,
  type Element,
  type ShapeElement,
} from './index';

const step = (id: string, x: number, y: number, label?: string): ShapeElement => ({
  ...(createShape('step', 0, 0) as ShapeElement),
  id,
  x,
  y,
  label,
});

describe('chip looks (docs/specs/009-elements/badge.md)', () => {
  it('defaults a badge to Solid and a step to Ink', () => {
    expect(chipLookOf(createShape('badge', 0, 0) as ShapeElement)).toBe('solid');
    expect(chipLookOf(createShape('step', 0, 0) as ShapeElement)).toBe('ink');
  });

  it('derives each look from the element colours', () => {
    const c = { accent: '#2563eb', surface: '#ffffff', ink: '#0f172a' };
    expect(chipColours('solid', c)).toMatchObject({ fill: '#2563eb', border: null });
    expect(chipColours('ink', c)).toMatchObject({ fill: '#0f172a', text: '#ffffff' });
    expect(chipColours('outline', c)).toMatchObject({
      fill: '#ffffff',
      border: '#2563eb',
      text: '#2563eb',
    });
  });

  it('writes and clears a look on a chip only', () => {
    const b = createShape('badge', 0, 0) as ShapeElement;
    expect(withChipLook(b, 'quiet').chipLook).toBe('quiet');
    expect('chipLook' in withChipLook({ ...b, chipLook: 'quiet' }, null)).toBe(false);
    const sq = createShape('square', 0, 0);
    expect(withChipLook(sq, 'quiet')).toBe(sq);
  });
});

describe('badge size', () => {
  it('is never narrower than tall and grows with its text', () => {
    const short = badgeSize('3', 'sm');
    expect(short.width).toBe(short.height);
    expect(badgeSize('Deprecated', 'sm').width).toBeGreaterThan(badgeSize('New', 'sm').width);
    expect(badgeSize('New', 'lg').height).toBeGreaterThan(badgeSize('New', 'sm').height);
  });
});

describe('step numbers (docs/specs/009-elements/step-number.md)', () => {
  it('takes one more than the highest whole number on the tab', () => {
    expect(nextStepNumber([])).toBe('1');
    expect(
      nextStepNumber([step('a', 0, 0, '2'), step('b', 0, 0, '7'), step('c', 0, 0, '3a')]),
    ).toBe('8');
  });

  it('renumbers in reading order: rows top to bottom, then left to right', () => {
    const els: Element[] = [
      step('right', 300, 10, '9'),
      step('below', 0, 200, '1'),
      step('left', 0, 0, '5'),
    ];
    const out = renumberSteps(els) as ShapeElement[];
    expect(out.map((s) => [s.id, s.label])).toEqual([
      ['right', '2'],
      ['below', '3'],
      ['left', '1'],
    ]);
  });
});

describe('chip validation, copies and export', () => {
  it('bounds the look and the attachment', () => {
    const b = createShape('badge', 0, 0) as ShapeElement;
    expect(isValidElement({ ...b, chipLook: 'quiet', attachedTo: 'x', attachAt: 'top' })).toBe(
      true,
    );
    expect(isValidElement({ ...b, chipLook: 'loud' })).toBe(false);
    expect(isValidElement({ ...b, attachAt: 'middle' })).toBe(false);
  });

  it('follows a copied host, and lands detached when copied alone', () => {
    const host = { ...(createShape('square', 0, 0) as ShapeElement), id: 'h' };
    const b = {
      ...(createShape('badge', 0, 0) as ShapeElement),
      id: 'b',
      attachedTo: 'h',
      attachAt: 'top' as const,
    };
    const both = duplicateElements([host, b], new Set(['h', 'b']), 10, 10)
      .newElements as ShapeElement[];
    const copyHost = both.find((e) => e.shape === 'square')!;
    expect(both.find((e) => e.shape === 'badge')!.attachedTo).toBe(copyHost.id);
    const alone = duplicateElements([host, b], new Set(['b']), 10, 10)
      .newElements as ShapeElement[];
    expect(alone[0]!.attachedTo).toBeUndefined();
    expect(alone[0]!.attachAt).toBeUndefined();
  });

  it('exports the pill in its look with its label', () => {
    const b = {
      ...(createShape('badge', 0, 0) as ShapeElement),
      strokeColor: '#2563eb',
      label: 'Beta',
    };
    const svg = svgBoxed(b);
    expect(svg).toContain('fill="#2563eb"');
    expect(svg).toContain('Beta');
  });
});

describe("the validator's copies of the lists", () => {
  it('match the chip looks and attach points', async () => {
    const { CHIP_LOOKS_RULE, ATTACH_POINTS_RULE } = await import('./validate-shape');
    const { CHIP_LOOKS, ATTACH_POINTS } = await import('./index');
    expect([...CHIP_LOOKS_RULE]).toEqual([...CHIP_LOOKS]);
    expect([...ATTACH_POINTS_RULE]).toEqual([...ATTACH_POINTS]);
  });
});
