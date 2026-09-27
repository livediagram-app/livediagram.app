import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MOTION_TOKENS, formatViolations, scanStylesheet } from './motion-budget';

// The shared theme is chrome for every app that imports it
// (docs/specs/004-interface-design/motion.md), so it is held to the budget itself.
describe('shared theme motion', () => {
  it('keeps every chrome duration within the budget', () => {
    const css = readFileSync(new URL('../theme.css', import.meta.url), 'utf8');
    expect(formatViolations(scanStylesheet(css, 'theme.css', MOTION_TOKENS))).toBe('');
  });
});
