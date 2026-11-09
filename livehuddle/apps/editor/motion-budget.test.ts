import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkMotionBudget, formatViolations } from '@liveworkspace/style-guards/motion-budget';

// The editor's chrome motion budget (docs/specs/004-interface-design/motion.md): every
// chrome transition settles within 250ms, hovers within 150ms, cascades as a
// whole within 250ms. Canvas motion follows its own specs and lives only in the
// stylesheets listed here, which the guard does not read.
const CANVAS_STYLESHEETS = [
  'app/canvas-motion.css',
  'app/meeting-motion.css',
  // The social pieces' own loops: flames, water, notes (docs/specs/009-elements/social-pieces.md).
  'app/social-motion.css',
  // The workday pieces' belt, dog and bell (docs/specs/009-elements/workday-pieces.md).
  'app/workday-motion.css',
  // The people arrows' nudge and hover (docs/specs/008-canvas/people-arrows.md).
  'app/people-arrows.css',
  // The pieces' one-shot moments: leaves, a pebble, sparks (docs/specs/009-elements/piece-moments.md).
  'app/piece-moments.css',
  // The office, amenity, venue and team pieces' moments: a page, steam, a sparrow.
  'app/piece-moments-office.css',
  // The animation sets (docs/specs/028-animation/element-animations.md).
  'app/motion-shape.css',
  'app/motion-text.css',
  'app/motion-sticky.css',
  'app/motion-drawing.css',
  'app/motion-media.css',
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
