import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  MOTION_CASCADE_CAP_MS,
  MOTION_CASCADE_STEP_MS,
  MOTION_CEILING_MS,
  MOTION_HOVER_CEILING_MS,
  MOTION_MS,
  cascadeDelayMs,
} from './motion';

const theme = readFileSync(new URL('../theme.css', import.meta.url), 'utf8');

/** The value a `--name: value;` declaration holds in theme.css. */
function themeValue(name: string): string | undefined {
  return new RegExp(`${name}:\\s*([^;]+);`).exec(theme)?.[1]?.trim();
}

describe('motion tokens', () => {
  it('keeps the three tiers within the spec ceilings', () => {
    expect(MOTION_MS).toEqual({ micro: 150, short: 200, long: 250 });
    expect(MOTION_CEILING_MS).toBe(250);
    expect(MOTION_HOVER_CEILING_MS).toBe(150);
  });

  it('lets a cascade of micro items settle exactly at the ceiling', () => {
    expect(MOTION_CASCADE_CAP_MS + MOTION_MS.micro).toBe(MOTION_CEILING_MS);
    expect(MOTION_CASCADE_STEP_MS).toBe(10);
  });

  it('declares every token in theme.css with the same value', () => {
    expect(themeValue('--transition-duration-micro')).toBe(`${MOTION_MS.micro}ms`);
    expect(themeValue('--transition-duration-short')).toBe(`${MOTION_MS.short}ms`);
    expect(themeValue('--transition-duration-long')).toBe(`${MOTION_MS.long}ms`);
    expect(themeValue('--motion-cascade-step')).toBe(`${MOTION_CASCADE_STEP_MS}ms`);
    expect(themeValue('--motion-cascade-cap')).toBe(`${MOTION_CASCADE_CAP_MS}ms`);
  });

  it('binds the bare transition utility to micro', () => {
    expect(themeValue('--default-transition-duration')).toBe('var(--transition-duration-micro)');
  });
});

describe('cascadeDelayMs', () => {
  it('steps each index by the cascade step', () => {
    expect(cascadeDelayMs(0)).toBe(0);
    expect(cascadeDelayMs(1)).toBe(10);
    expect(cascadeDelayMs(7)).toBe(70);
  });

  it('stops growing at the cap', () => {
    expect(cascadeDelayMs(10)).toBe(100);
    expect(cascadeDelayMs(11)).toBe(100);
    expect(cascadeDelayMs(500)).toBe(100);
  });

  it('clamps negative and non-finite indices to zero and floors fractions', () => {
    expect(cascadeDelayMs(-3)).toBe(0);
    expect(cascadeDelayMs(Number.NaN)).toBe(0);
    expect(cascadeDelayMs(2.9)).toBe(20);
    expect(cascadeDelayMs(Number.POSITIVE_INFINITY)).toBe(100);
  });
});
