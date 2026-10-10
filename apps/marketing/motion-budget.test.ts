import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkMotionBudget, formatViolations } from '@livediagram/tailwind-config/motion-budget';

// The marketing site's chrome (navigation, cards, buttons) keeps the motion budget
// (docs/specs/004-interface-design/motion.md). Its illustrations and its page
// entrance are paced as content, and their motion lives only in the stylesheets
// listed here.
const CONTENT_STYLESHEETS = [
  'app/hero-animations.css',
  'app/hero-mode-animations.css',
  'app/promises.css',
  // The card illustrations' loops, one stylesheet per art group.
  ...readdirSync(fileURLToPath(new URL('app/feature-art/', import.meta.url)))
    .filter((f) => f.endsWith('.css'))
    .map((f) => `app/feature-art/${f}`),
  'app/page-motion.css',
];

describe('marketing motion budget', () => {
  it('keeps every chrome duration within the budget', () => {
    const root = fileURLToPath(new URL('.', import.meta.url));
    const violations = checkMotionBudget({ root, canvasStylesheets: CONTENT_STYLESHEETS });
    expect(formatViolations(violations)).toBe('');
  });
});
