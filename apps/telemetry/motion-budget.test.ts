import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkMotionBudget, formatViolations } from '@livediagram/tailwind-config/motion-budget';

// The dashboard is all chrome, data-viz reveals included, so all of it keeps the
// motion budget (docs/specs/004-interface-design/motion.md).
describe('telemetry motion budget', () => {
  it('keeps every chrome duration within the budget', () => {
    const root = fileURLToPath(new URL('.', import.meta.url));
    expect(formatViolations(checkMotionBudget({ root }))).toBe('');
  });
});
