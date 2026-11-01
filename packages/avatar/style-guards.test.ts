import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  checkMotionBudget,
  formatViolations as formatMotion,
} from '@liveworkspace/style-guards/motion-budget';
import {
  checkOpticalAlignment,
  formatViolations as formatOptical,
} from '@liveworkspace/style-guards/optical-guard';
import {
  checkTouchTargets,
  formatTouchTargetViolations,
} from '@liveworkspace/style-guards/touch-target-guard';

// The editors' style guards, run over the Avatar-mode code they share here (each editor runs the same guards
// over its own folders): docs/specs/004-interface-design/optical-alignment.md, touch-targets.md and
// motion.md in each product.
const root = fileURLToPath(new URL('./src', import.meta.url));

describe('avatar style guards', () => {
  it('holds no bare text in a centring circle or pill', () => {
    expect(formatOptical(checkOpticalAlignment({ root }))).toBe('');
  });

  it('positions every control that carries a touch-target pad', () => {
    expect(formatTouchTargetViolations(checkTouchTargets({ root }))).toBe('');
  });

  it('keeps every chrome duration within the motion budget', () => {
    expect(formatMotion(checkMotionBudget({ root }))).toBe('');
  });
});
