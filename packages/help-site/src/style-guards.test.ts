import { readFileSync } from 'node:fs';
import { join } from 'node:path';
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

  // touch-targets.md: the category link over an article's title is a 15px line of small capitals, a target of its
  // own (not a link inside prose), so on a touch screen its tap area reaches 44px tall.
  it("pads the article's category link on a touch screen", () => {
    const shell = readFileSync(join(root, 'components', 'ArticleShell.tsx'), 'utf8');
    const at = shell.indexOf('<Link href={category.href}');
    expect(at).toBeGreaterThan(-1);
    expect(shell.slice(at, shell.indexOf('>', at))).toContain('touch-target-y');
  });
});
