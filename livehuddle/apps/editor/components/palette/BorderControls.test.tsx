// @vitest-environment jsdom

// The Border category's Strength and Pattern grids: each tile draws only an icon, so each carries a name for
// its tooltip and screen readers (docs/specs/004-interface-design/tooltips-hover-cards-popovers.md).

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BorderControls } from './BorderControls';

afterEach(cleanup);

const show = () => {
  const onCommitBorderStyle = vi.fn();
  render(
    <BorderControls
      strokeWidth="thin"
      strokeStyle="solid"
      onCommitBorderStroke={vi.fn()}
      onPreviewBorderStroke={vi.fn()}
      onCommitBorderStyle={onCommitBorderStyle}
      onPreviewBorderStyle={vi.fn()}
      onPreviewStyleEnd={vi.fn()}
    />,
  );
  return { onCommitBorderStyle };
};

describe('BorderControls', () => {
  it('names every tile, each name once', () => {
    show();
    const names = screen.getAllByRole('button').map((b) => b.getAttribute('aria-label') ?? '');
    expect(names).toHaveLength(5 + 6);
    for (const name of names) expect(name).toMatch(/^[A-Z]/);
    expect(new Set(names).size).toBe(names.length);
  });

  it('draws no Radius grid', () => {
    show();
    expect(screen.queryByRole('button', { name: 'Fully Round' })).toBeNull();
  });

  it('spells out each value', () => {
    const { onCommitBorderStyle } = show();
    expect(screen.getByRole('button', { name: 'Extra Thick' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Thin' }).getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('button', { name: 'Medium' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Dash Dot Dot' }));
    expect(onCommitBorderStyle).toHaveBeenCalledWith('dash-dot-dot');
  });
});
