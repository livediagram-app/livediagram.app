import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkMotionBudget, formatViolations as formatMotion } from '@liveworkspace/style-guards/motion-budget';
import {
  checkOpticalAlignment,
  formatViolations as formatOptical,
} from '@liveworkspace/style-guards/optical-guard';
import {
  checkTouchTargets,
  formatTouchTargetViolations,
} from '@liveworkspace/style-guards/touch-target-guard';

// The style guards each product's help app ran over itself, run once over the one help centre (its app/, components/,
// editions/ and lib/): the same checks, with no allow-list in any of the five copies.
const root = fileURLToPath(new URL('../..', import.meta.url));

describe('help centre style guards', () => {
  // The help centre is all chrome (docs/specs/004-interface-design/motion.md): every transition settles within 250ms
  // and every hover within 150ms.
  it('keeps every chrome duration within the motion budget', () => {
    expect(formatMotion(checkMotionBudget({ root }))).toBe('');
  });

  // A glyph in a circle or pill centres its cap band, not its line box
  // (docs/specs/004-interface-design/optical-alignment.md): text goes through text-optical-centre or a primitive.
  it('holds no bare text in a centring circle or pill', () => {
    expect(formatOptical(checkOpticalAlignment({ root }))).toBe('');
  });

  // A touch-target pad is an absolutely positioned ::before, so its host is positioned
  // (docs/specs/004-interface-design/touch-targets.md): a static one let the pad take every tap around it.
  it('positions every control that carries a touch-target pad', () => {
    expect(formatTouchTargetViolations(checkTouchTargets({ root }))).toBe('');
  });
});
