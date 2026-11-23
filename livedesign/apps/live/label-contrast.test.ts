import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { checkLabelContrast } from '@liveworkspace/style-guards/label-contrast';

// Small text reads at WCAG AA (docs/specs/004-interface-design/color-scheme.md "Accessibility"): slate-400 on
// white is 2.6:1, under the 4.5:1 small text needs (issue #863), so a small or uppercase label's light colour is
// slate-500 or darker. This scans the editor's sources for a class string that pairs a small size or `uppercase`
// with a bare (light-mode) `text-slate-400` (or `!text-slate-400`); a variant (`dark:`, `placeholder:`) is not matched.
// The rule itself is every editor's (packages/style-guards/src/label-contrast.ts); this runs it over this editor's folders.

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const DIRS = [
  'app',
  'components',
  'hooks',
  'lib',
  // The editor code every editor shares (@liveworkspace/workbench) renders here too, so it is held to the rule as well.
  '../../../packages/workbench/src',
];

describe('small labels read at AA', () => {
  it('pairs no small or uppercase text with a light-mode text-slate-400', () => {
    expect(checkLabelContrast({ root: ROOT, dirs: DIRS })).toEqual([]);
  });
});
