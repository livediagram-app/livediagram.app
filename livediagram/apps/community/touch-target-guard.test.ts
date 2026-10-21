import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  checkTouchTargets,
  formatTouchTargetViolations,
} from '@livediagram/tailwind-config/touch-target-guard';

// A touch-target pad is an absolutely positioned ::before, so its host is positioned
// (docs/specs/004-interface-design/touch-targets.md): a static one let the pad take every tap around it.
describe('community touch targets', () => {
  it('positions every control that carries a touch-target pad', () => {
    const root = fileURLToPath(new URL('.', import.meta.url));
    expect(formatTouchTargetViolations(checkTouchTargets({ root }))).toBe('');
  });
});
