import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkMotionBudget, formatViolations } from '@livediagram/tailwind-config/motion-budget';

// The help centre is all chrome (docs/specs/004-interface-design/motion.md): every
// transition settles within 250ms and every hover within 150ms.
describe('help centre motion budget', () => {
  it('keeps every chrome duration within the budget', () => {
    const root = fileURLToPath(new URL('.', import.meta.url));
    expect(formatViolations(checkMotionBudget({ root }))).toBe('');
  });
});
