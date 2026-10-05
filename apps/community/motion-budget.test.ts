import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkMotionBudget, formatViolations } from '@livediagram/tailwind-config/motion-budget';

// The Community app is all chrome (docs/specs/004-interface-design/motion.md): every transition
// settles within the budget, and every hover within the hover ceiling.
describe('community motion budget', () => {
  it('keeps every chrome duration within the budget', () => {
    const root = fileURLToPath(new URL('.', import.meta.url));
    expect(formatViolations(checkMotionBudget({ root }))).toBe('');
  });
});
