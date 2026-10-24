import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkMotionBudget, formatViolations } from '@liveworkspace/style-guards/motion-budget';

// The shared marketing pages keep the motion budget (docs/specs/004-interface-design/motion.md, in each product),
// as each app's own motion-budget test does for its pages. The hero fan's swap, the promises and the page
// entrance are paced as content, and their motion lives only in these stylesheets.
const CONTENT_STYLESHEETS = ['css/hero-fan.css', 'css/promises.css', 'css/page-motion.css'];

describe('shared marketing motion budget', () => {
  it('keeps every chrome duration within the budget', () => {
    const root = fileURLToPath(new URL('.', import.meta.url));
    const violations = checkMotionBudget({ root, canvasStylesheets: CONTENT_STYLESHEETS });
    expect(formatViolations(violations)).toBe('');
  });
});
