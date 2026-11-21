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

// The editors' style guards, run over the Automations screen they share (each editor runs the same guards over its
// own folders): optical-alignment.md, touch-targets.md and motion.md in each product. The pictures' motion is a
// content illustration (motion.md "Where durations live"): its durations live in automation-scenes.css, which the
// budget does not read.
const root = fileURLToPath(new URL('./src', import.meta.url));
const SCENES = ['automation-scenes.css'];

describe('automations-ui style guards', () => {
  it('holds no bare text in a centring circle or pill', () => {
    expect(formatOptical(checkOpticalAlignment({ root }))).toBe('');
  });

  it('positions every control that carries a touch-target pad', () => {
    expect(formatTouchTargetViolations(checkTouchTargets({ root }))).toBe('');
  });

  it('keeps every chrome duration within the motion budget', () => {
    expect(formatMotion(checkMotionBudget({ root, canvasStylesheets: SCENES }))).toBe('');
  });
});
