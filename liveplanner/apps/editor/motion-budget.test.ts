import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkMotionBudget, formatViolations } from '@liveworkspace/style-guards/motion-budget';

// The editor's chrome motion budget (docs/specs/004-interface-design/motion.md): every
// chrome transition settles within 250ms, hovers within 150ms, cascades as a
// whole within 250ms. Canvas motion follows its own specs and lives only in the
// stylesheets listed here, which the guard does not read.
const CANVAS_STYLESHEETS = [
  'app/canvas-motion.css',
  'app/collab-cards.css',
  // A form cover's animated backgrounds (docs/specs/030-forms/forms.md "The form card, top to bottom").
  'app/motion-page.css',
  // The account and connect pages' entrance and lines (docs/specs/014-identity/auth-and-guest-access.md).
  'app/auth-motion.css',
];

describe('editor motion budget', () => {
  it('keeps every chrome duration within the budget', () => {
    const root = fileURLToPath(new URL('.', import.meta.url));
    const violations = checkMotionBudget({ root, canvasStylesheets: CANVAS_STYLESHEETS });
    expect(formatViolations(violations)).toBe('');
  });
});
