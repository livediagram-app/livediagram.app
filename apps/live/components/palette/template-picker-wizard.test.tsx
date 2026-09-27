// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { WizardSteps } from './template-picker-wizard';

// A circle at the start of a pill is concentric with it (docs/specs/004-interface-design/color-scheme.md,
// Usage rules): the leading padding equals the vertical padding at every breakpoint, so the pill's round
// cap hugs the step circle instead of leaving a crescent of pill beside it.
const SPACING = /^(sm:)?(p|px|py|pl|pt|pb)-(.+)$/;

/** The step chip's padding per breakpoint: { '': { left, top, bottom }, 'sm:': {...} }. */
function insets(
  className: string,
): Record<string, { left?: string; top?: string; bottom?: string }> {
  const out: Record<string, { left?: string; top?: string; bottom?: string }> = {
    '': {},
    'sm:': {},
  };
  for (const token of className.split(/\s+/)) {
    const m = SPACING.exec(token);
    if (!m) continue;
    const [, bp = '', side, value] = m;
    const at = out[bp]!;
    if (side === 'p' || side === 'px' || side === 'pl') at.left = value;
    if (side === 'p' || side === 'py' || side === 'pt') at.top = value;
    if (side === 'p' || side === 'py' || side === 'pb') at.bottom = value;
  }
  // A breakpoint inherits whatever it does not restate.
  out['sm:'] = { ...out['']!, ...out['sm:'] };
  return out;
}

describe('the wizard step rail', () => {
  it("keeps the current step's circle concentric with its pill", () => {
    render(<WizardSteps step="template" onStep={() => {}} />);
    const chip = screen.getByRole('button', { name: /Template/ });
    for (const [bp, inset] of Object.entries(insets(chip.className))) {
      expect(inset.left, `leading inset ${bp || 'base'}`).toBe(inset.top);
      expect(inset.top, `vertical insets ${bp || 'base'}`).toBe(inset.bottom);
    }
  });
});
