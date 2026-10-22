import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkMotionBudget, formatViolations } from '@livediagram/tailwind-config/motion-budget';

// The site's chrome keeps the motion budget (docs/specs/004-interface-design/motion.md).
// Its data-viz reveals and the home page's illustrations are paced as content and live only in the
// stylesheets listed here.
const CONTENT_STYLESHEETS = ['app/telemetry/dataviz-motion.css', 'app/landing-motion.css'];

describe('site motion budget', () => {
  it('keeps every chrome duration within the budget', () => {
    const root = fileURLToPath(new URL('.', import.meta.url));
    const violations = checkMotionBudget({ root, canvasStylesheets: CONTENT_STYLESHEETS });
    expect(formatViolations(violations)).toBe('');
  });
});
