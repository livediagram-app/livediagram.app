// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { StableLabel } from './StableLabel';

// A label that never changes its control's width as its wording changes
// (docs/specs/022-drive-mirror/drive-mirror.md, "Nothing reflows as the state changes").
describe('StableLabel', () => {
  it('lays every wording in one cell, showing only the current one', () => {
    const { container } = render(
      <StableLabel options={['Sync now', 'Syncing…']} current="Syncing…" />,
    );
    const cells = [...container.querySelectorAll('[data-stable-option]')] as HTMLElement[];
    expect(cells.map((c) => c.textContent)).toEqual(['Sync now', 'Syncing…']);
    for (const cell of cells) expect(cell.className).toContain('[grid-area:1/1]');
    expect(cells[0]!.className).toContain('invisible');
    expect(cells[0]!.getAttribute('aria-hidden')).toBe('true');
    expect(cells[1]!.className).not.toContain('invisible');
    expect(cells[1]!.hasAttribute('aria-hidden')).toBe(false);
  });

  it('names its control with the current wording only', () => {
    render(
      <button type="button">
        <StableLabel options={['Sync now', 'Syncing…']} current="Sync now" />
      </button>,
    );
    expect(screen.getByRole('button').textContent).toContain('Syncing…');
    expect(screen.getByRole('button', { name: 'Sync now' })).toBeTruthy();
  });

  it('lays out as a block for a paragraph', () => {
    const { container } = render(<StableLabel options={['a', 'b']} current="a" block />);
    expect((container.firstElementChild as HTMLElement).className).toBe('grid');
  });

  it('shows a wording it was not told about rather than nothing', () => {
    const { container } = render(<StableLabel options={['A']} current="B" />);
    expect(container.querySelector('[data-stable-option]:not(.invisible)')!.textContent).toBe('B');
  });
});
