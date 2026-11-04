import { describe, expect, it } from 'vitest';
import { FONTS } from '@liveplanner/project';
import {
  PROJECT_DESCRIPTION_MAX,
  readOverviewStyle,
  readProjectDescription,
} from './project-details';

// docs/specs/026-plan/plan-overview.md "The description".
describe('readProjectDescription', () => {
  it('trims a description and keeps its line breaks', () => {
    expect(readProjectDescription('  Where bugs land.\nThen fixed.  ')).toBe(
      'Where bugs land.\nThen fixed.',
    );
  });

  it('reads anything but a string as empty', () => {
    expect(readProjectDescription(undefined)).toBe('');
    expect(readProjectDescription(null)).toBe('');
    expect(readProjectDescription(42)).toBe('');
  });

  it('caps a long description at the limit', () => {
    const long = 'a'.repeat(PROJECT_DESCRIPTION_MAX + 50);
    expect(readProjectDescription(long)).toHaveLength(PROJECT_DESCRIPTION_MAX);
  });

  it('never keeps half of a character cut at the limit', () => {
    const text = `${'a'.repeat(PROJECT_DESCRIPTION_MAX - 1)}😀 more`;
    const read = readProjectDescription(text);
    expect(read).toBe('a'.repeat(PROJECT_DESCRIPTION_MAX - 1));
  });

  it('drops the space a cut leaves at the end', () => {
    const text = `${'a'.repeat(PROJECT_DESCRIPTION_MAX - 1)} b`;
    expect(readProjectDescription(text)).toBe('a'.repeat(PROJECT_DESCRIPTION_MAX - 1));
  });
});

// docs/specs/026-plan/plan-overview.md "The Overview's style".
describe('readOverviewStyle', () => {
  it('keeps every setting a tab could hold', () => {
    const style = {
      theme: 'brand',
      backgroundPattern: 'lines',
      backgroundColor: '#0f172a',
      patternColor: 'rgb(30 41 59)',
      backgroundOpacity: 0.5,
      backgroundPatternScale: 1.5,
      backgroundAnimationSpeed: 2,
      font: FONTS[0]!.id,
      defaultTextSize: 'lg',
    } as const;
    expect(readOverviewStyle(style)).toEqual(style);
  });

  it('keeps a whole px text size in range', () => {
    expect(readOverviewStyle({ defaultTextSize: 18 })).toEqual({ defaultTextSize: 18 });
    expect(readOverviewStyle({ defaultTextSize: 18.5 })).toBeNull();
    expect(readOverviewStyle({ defaultTextSize: 400 })).toBeNull();
  });

  it('drops what a tab could not hold, and reads nothing left as none', () => {
    expect(
      readOverviewStyle({
        theme: 'no-such-theme',
        backgroundPattern: 'plaid',
        backgroundColor: 'url(javascript:alert(1))',
        patternColor: '',
        backgroundOpacity: 2,
        backgroundPatternScale: Number.NaN,
        backgroundAnimationSpeed: '1',
        font: 'comic-sans',
        defaultTextSize: 'huge',
        extra: true,
      }),
    ).toBeNull();
    expect(readOverviewStyle({ theme: 'brand', extra: 1 })).toEqual({ theme: 'brand' });
  });

  it('reads anything but an object as none', () => {
    expect(readOverviewStyle(null)).toBeNull();
    expect(readOverviewStyle('dark')).toBeNull();
    expect(readOverviewStyle([{ theme: 'brand' }])).toBeNull();
    expect(readOverviewStyle({ backgroundColor: 'x'.repeat(65) })).toBeNull();
  });
});
