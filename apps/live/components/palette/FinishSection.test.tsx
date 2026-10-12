// @vitest-environment jsdom

// The Finish category (docs/specs/008-canvas/finish.md "Where it is set"): Follow Tab plus the three finishes,
// the element's own pressed, hover previews, click commits, Follow Tab clears.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Finish } from '@livediagram/document';
import { FinishSection, resolveOwnFinish } from './FinishSection';

afterEach(() => cleanup());

const renderSection = (finish: Finish | undefined) => {
  const handlers = { onCommit: vi.fn(), onPreview: vi.fn(), onPreviewEnd: vi.fn() };
  render(
    <FinishSection finish={finish} section={{ open: true, onToggle: vi.fn() }} {...handlers} />,
  );
  return handlers;
};
// Each row's name is its label then its one-line description.
const tile = (name: string) => screen.getByRole('radio', { name: new RegExp(`^${name}`) });

describe('FinishSection', () => {
  it('offers Follow Tab and the three finishes as one full-width list, in order', () => {
    renderSection(undefined);
    const rows = screen
      .getByRole('radiogroup', { name: 'Drawn As' })
      .querySelectorAll('[role="radio"]');
    expect([...rows].map((r) => r.getAttribute('data-option'))).toEqual([
      'follow-tab',
      'flexible',
      'professional',
      'sketch',
    ]);
  });

  it('presses Follow Tab for an element without its own finish', () => {
    renderSection(undefined);
    expect(tile('Follow Tab').getAttribute('aria-checked')).toBe('true');
    expect(tile('Sketch').getAttribute('aria-checked')).toBe('false');
  });

  it("presses the element's own finish", () => {
    renderSection('professional');
    expect(tile('Professional').getAttribute('aria-checked')).toBe('true');
    expect(tile('Follow Tab').getAttribute('aria-checked')).toBe('false');
  });

  it('commits a finish on click, and Follow Tab as null', () => {
    const h = renderSection('sketch');
    fireEvent.click(tile('Flexible'));
    expect(h.onCommit).toHaveBeenLastCalledWith('flexible');
    fireEvent.click(tile('Follow Tab'));
    expect(h.onCommit).toHaveBeenLastCalledWith(null);
  });

  it('previews on mouse hover and ends the preview on leave', () => {
    const h = renderSection(undefined);
    fireEvent.pointerEnter(tile('Sketch'), { pointerType: 'mouse' });
    expect(h.onPreview).toHaveBeenLastCalledWith('sketch');
    fireEvent.pointerLeave(tile('Sketch'), { pointerType: 'mouse' });
    expect(h.onPreviewEnd).toHaveBeenCalled();
  });
});

describe('resolveOwnFinish', () => {
  it('reads a stored finish and treats anything else as following the tab', () => {
    expect(resolveOwnFinish({ finish: 'sketch' })).toBe('sketch');
    expect(resolveOwnFinish({ finish: 'neon' })).toBeUndefined();
    expect(resolveOwnFinish({})).toBeUndefined();
    expect(resolveOwnFinish(undefined)).toBeUndefined();
  });
});
