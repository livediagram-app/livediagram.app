import { describe, expect, it } from 'vitest';
import { ANIMATED_BACKGROUND_PATTERNS, isAnimatedPattern, type BackgroundPattern } from './index';

describe('isAnimatedPattern', () => {
  it('is true for every animated pattern', () => {
    for (const pattern of ANIMATED_BACKGROUND_PATTERNS) {
      expect(isAnimatedPattern(pattern)).toBe(true);
    }
  });

  it('is false for the static patterns', () => {
    const staticPatterns: BackgroundPattern[] = [
      'grid',
      'blank',
      'lines',
      'crosshatch',
      'graph',
      'confetti',
      'stripes',
      'diagonal',
      'waves',
      'bricks',
      'isometric',
      'hexagonal',
      'engineering',
      'checkerboard',
    ];
    for (const pattern of staticPatterns) {
      expect(isAnimatedPattern(pattern)).toBe(false);
    }
  });
});
