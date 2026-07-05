import { describe, expect, it } from 'vitest';
import { createAnnotation, createShape, createSticky, createText } from '@livediagram/diagram';
import { describeMany, describeOne, elementAriaLabel, kindLabel } from './element-names';

// Shared element naming (spec/71 + spec/12): the change log and the
// canvas aria-labels / announcements read the same names. These tests
// pin the formats both surfaces rely on.

const square = (label?: string) => ({ ...createShape('square', 0, 0), label });
const arrow = (label?: string) => ({
  id: 'ar',
  type: 'arrow' as const,
  from: { kind: 'free' as const, x: 0, y: 0 },
  to: { kind: 'free' as const, x: 10, y: 10 },
  label,
});

describe('kindLabel', () => {
  it('names shapes by their concrete sub-kind, others by type', () => {
    expect(kindLabel(square())).toBe('Square');
    expect(kindLabel(arrow())).toBe('Arrow');
    expect(kindLabel(createSticky(0, 0))).toBe('Sticky note');
    expect(kindLabel(createText(0, 0))).toBe('Text');
    expect(kindLabel(createAnnotation(0, 0))).toBe('Annotation');
  });
});

describe('describeOne / describeMany', () => {
  it('prefers the quoted label, falls back to the articled kind', () => {
    expect(describeOne(square('Login'))).toBe("'Login'");
    expect(describeOne(square())).toBe('a Square');
    expect(describeOne(arrow('yes'))).toBe('an Arrow');
  });

  it('groups a mixed multi-selection by kind', () => {
    expect(describeMany([square(), square(), arrow()])).toBe('2 Squares & an Arrow');
  });
});

describe('elementAriaLabel', () => {
  it('leads with the kind, then the quoted label when present', () => {
    expect(elementAriaLabel(square('Login'))).toBe('Square "Login"');
    expect(elementAriaLabel(square('  '))).toBe('Square');
    expect(elementAriaLabel(arrow('yes'))).toBe('Arrow "yes"');
    expect(elementAriaLabel(createSticky(0, 0))).toBe('Sticky note');
  });
});
