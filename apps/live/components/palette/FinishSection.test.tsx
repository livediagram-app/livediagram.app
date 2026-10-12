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
const tile = (name: string) => screen.getByRole('button', { name });

describe('FinishSection', () => {
  it('offers Follow Tab and the three finishes, in order', () => {
    renderSection(undefined);
    const names = ['Follow Tab', 'Flexible', 'Professional', 'Sketch'];
    for (const n of names) expect(tile(n)).toBeTruthy();
  });

  it('presses Follow Tab for an element without its own finish', () => {
    renderSection(undefined);
    expect(tile('Follow Tab').getAttribute('aria-pressed')).toBe('true');
    expect(tile('Sketch').getAttribute('aria-pressed')).toBe('false');
  });

  it("presses the element's own finish", () => {
    renderSection('professional');
    expect(tile('Professional').getAttribute('aria-pressed')).toBe('true');
    expect(tile('Follow Tab').getAttribute('aria-pressed')).toBe('false');
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
