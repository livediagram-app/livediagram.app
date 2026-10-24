import { describe, expect, it } from 'vitest';
import { AVATAR_TEXT_CONTRAST, avatarFill, whiteContrast } from './avatar-fill';

const rgbOf = (hex: string) =>
  [1, 3, 5].map((i) => Number.parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];

// Every presence colour an app offers (@liveworkspace/settings PRESENCE_COLOURS).
const PRESENCE = [
  '#0ea5e9',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#14b8a6',
  '#f97316',
  '#6366f1',
  '#84cc16',
];

describe('avatarFill', () => {
  it('darkens orange, still orange, until white initials reach 4.5:1', () => {
    expect(whiteContrast(rgbOf('#f97316'))).toBeLessThan(3);
    const fill = avatarFill('#f97316')!;
    expect(fill).toBe('#bb5611');
    expect(whiteContrast(rgbOf(fill))).toBeGreaterThanOrEqual(AVATAR_TEXT_CONTRAST);
    const [r, g, b] = rgbOf(fill);
    // The same hue: red leads green leads blue, as in #f97316.
    expect(r > g && g > b).toBe(true);
  });

  it('gives every presence colour a fill white reads on at AA', () => {
    for (const colour of PRESENCE) {
      const fill = avatarFill(colour)!;
      expect(whiteContrast(rgbOf(fill)), `${colour} → ${fill}`).toBeGreaterThanOrEqual(
        AVATAR_TEXT_CONTRAST,
      );
    }
  });

  it('keeps a colour white already reads on, and reads #rgb', () => {
    expect(avatarFill('#1E293B')).toBe('#1e293b');
    expect(whiteContrast(rgbOf(avatarFill('#f80')!))).toBeGreaterThanOrEqual(AVATAR_TEXT_CONTRAST);
  });

  it('leaves the disc its own fill for a colour it cannot read', () => {
    expect(avatarFill('var(--accent)')).toBeNull();
    expect(avatarFill('orange')).toBeNull();
  });

  // Every avatar on a long inbox asks; a cheap guard against it ever becoming a hot spot.
  it('answers 10,000 avatars well inside a frame', () => {
    const start = performance.now();
    for (let i = 0; i < 10_000; i++) avatarFill(PRESENCE[i % PRESENCE.length]!);
    for (let i = 0; i < 200; i++) avatarFill(`#${(i * 81).toString(16).padStart(6, '0')}`);
    expect(performance.now() - start).toBeLessThan(50);
  });
});
