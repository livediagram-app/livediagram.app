import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkMotionBudget, formatViolations } from '@livediagram/tailwind-config/motion-budget';

// Shared chrome (docs/specs/004-interface-design/motion.md): every app renders these
// components, so they are held to the motion budget here, at the source.
describe('shared UI motion', () => {
  it('keeps every chrome duration within the budget', () => {
    const root = fileURLToPath(new URL('.', import.meta.url));
    expect(formatViolations(checkMotionBudget({ root }))).toBe('');
  });
});
