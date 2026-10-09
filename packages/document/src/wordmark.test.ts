import { describe, expect, it } from 'vitest';
import { elementValidationIssue } from './validate';
import {
  arcGeometry,
  arcText,
  clampLetterSpacing,
  clampTextArc,
  hasWordmarkType,
  resolvedFontWeight,
  wordmarkDisplayText,
} from './wordmark';

// docs/specs/007-editor/logo-pages.md "Wordmark type".
describe('wordmark type', () => {
  it('is present when any of its four fields is', () => {
    expect(hasWordmarkType({})).toBe(false);
    expect(hasWordmarkType({ letterSpacing: 0.1 })).toBe(true);
    expect(hasWordmarkType({ fontWeight: 500 })).toBe(true);
    expect(hasWordmarkType({ textCase: 'upper' })).toBe(true);
    expect(hasWordmarkType({ textArc: -90 })).toBe(true);
  });

  it('shows the case without changing what was typed', () => {
    expect(wordmarkDisplayText('Brand co', 'upper')).toBe('BRAND CO');
    expect(wordmarkDisplayText('Brand Co', 'lower')).toBe('brand co');
    expect(wordmarkDisplayText('Brand Co', undefined)).toBe('Brand Co');
  });

  it('paints its own weight over bold, else bold, else regular', () => {
    expect(resolvedFontWeight({ fontWeight: 500, textBold: true })).toBe(500);
    expect(resolvedFontWeight({ textBold: true })).toBe(700);
    expect(resolvedFontWeight({})).toBe(400);
  });

  it('clamps tracking and arc, storing none as absent', () => {
    expect(clampLetterSpacing(2)).toBe(1);
    expect(clampLetterSpacing(-1)).toBe(-0.2);
    expect(clampLetterSpacing(0.123)).toBe(0.12);
    expect(clampLetterSpacing(0)).toBeUndefined();
    expect(clampLetterSpacing(Number.NaN)).toBeUndefined();
    expect(clampTextArc(400)).toBe(360);
    expect(clampTextArc(-90.4)).toBe(-90);
    expect(clampTextArc(0.2)).toBeUndefined();
    expect(clampTextArc(Number.POSITIVE_INFINITY)).toBeUndefined();
  });

  it('reads line breaks as spaces on an arc', () => {
    expect(arcText('Brand\nCo')).toBe('Brand Co');
  });

  it('validates the fields', () => {
    const base = { id: 't', type: 'text', x: 0, y: 0, width: 10, height: 10 };
    expect(elementValidationIssue({ ...base, letterSpacing: 0.5, fontWeight: 500 })).toBeNull();
    expect(elementValidationIssue({ ...base, textCase: 'upper', textArc: -360 })).toBeNull();
    expect(elementValidationIssue({ ...base, letterSpacing: 3 })?.field).toBe('letterSpacing');
    expect(elementValidationIssue({ ...base, fontWeight: 600 })?.field).toBe('fontWeight');
    expect(elementValidationIssue({ ...base, textCase: 'title' })?.field).toBe('textCase');
    expect(elementValidationIssue({ ...base, textArc: 361 })?.field).toBe('textArc');
  });
});

describe('arc geometry', () => {
  const box = { width: 400, height: 200 };

  it('spans the box width under 180 degrees, bowing up or down', () => {
    const up = arcGeometry(box, 90, 20);
    expect(up.d).toMatch(/^M 0 [\d.]+ A [\d.]+ [\d.]+ 0 0 1 400 [\d.]+$/);
    const down = arcGeometry(box, -90, 20);
    expect(down.d).toMatch(/ 0 0 0 400 /);
    // A 90 degree arc over a 400 px chord: r = 200 / sin(45°).
    expect(up.length).toBeCloseTo((200 / Math.sin(Math.PI / 4)) * (Math.PI / 2), 5);
  });

  it('centres a shallow arc band in the box', () => {
    const g = arcGeometry(box, 60, 0);
    const r = 200 / Math.sin(Math.PI / 6);
    const sag = r * (1 - Math.cos(Math.PI / 6));
    const y = Number(g.d.split(' ')[2]);
    expect(y).toBeCloseTo(100 + sag / 2, 1);
  });

  it('keeps its padding clear', () => {
    expect(arcGeometry({ ...box, padding: 10 }, 45, 10).d).toMatch(/^M 10 .* 390 [\d.]+$/);
  });

  it('runs a fitted circle from 180 degrees, centred on the top or the bottom', () => {
    const square = { width: 300, height: 300 };
    const top = arcGeometry(square, 180, 20);
    // Up: radius 150 less 0.8em; starts at the left, 180 degrees over the top to the right.
    const R = 150 - 16;
    expect(top.d.startsWith(`M ${150 - R} 150 A ${R} ${R} 0 0 1 150 ${150 - R}`)).toBe(true);
    expect(top.length).toBeCloseTo(R * Math.PI, 5);
    const bottom = arcGeometry(square, -180, 20);
    const Rb = 150 - 5;
    expect(bottom.d.startsWith(`M ${150 - Rb} 150 A ${Rb} ${Rb} 0 0 0 150 ${150 + Rb}`)).toBe(true);
  });

  it('closes the whole circle at 360, in two halves', () => {
    const g = arcGeometry({ width: 200, height: 200 }, 360, 10);
    expect(g.d.match(/A /g)).toHaveLength(2);
    expect(g.length).toBeCloseTo(92 * 2 * Math.PI, 5);
  });

  it('never shrinks the circle below the font size', () => {
    const g = arcGeometry({ width: 20, height: 20 }, 270, 40);
    expect(g.length).toBeCloseTo(40 * 1.5 * Math.PI, 5);
  });
});
