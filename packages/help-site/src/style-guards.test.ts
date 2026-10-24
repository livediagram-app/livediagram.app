import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkMotionBudget, formatViolations } from '@liveworkspace/style-guards/motion-budget';
import {
  checkOpticalAlignment,
  formatViolations as formatOpticalViolations,
} from '@liveworkspace/style-guards/optical-guard';
import {
  checkTouchTargets,
  formatTouchTargetViolations,
} from '@liveworkspace/style-guards/touch-target-guard';

// The help centre's shared components, held to the same style guards as each help app's own files
// (docs/specs/004-interface-design in each product: motion.md, optical-alignment.md, touch-targets.md).
const root = fileURLToPath(new URL('.', import.meta.url));

describe('help-site style guards', () => {
  it('keeps every chrome duration within the motion budget', () => {
    expect(formatViolations(checkMotionBudget({ root }))).toBe('');
  });

  it('holds no bare text in a centring circle or pill', () => {
    expect(formatOpticalViolations(checkOpticalAlignment({ root }))).toBe('');
  });

  it('positions every control that carries a touch-target pad', () => {
    expect(formatTouchTargetViolations(checkTouchTargets({ root }))).toBe('');
  });
});
