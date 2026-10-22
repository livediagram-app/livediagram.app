// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { KindChips } from './CollaborateControls';

// docs/specs/012-collaboration/assigned-actions.md "Kind chips": All in words, Comments and Actions
// as a glyph and a count, named for screen readers and tooltips.
describe('KindChips', () => {
  it('shows All as a word and the other two as glyph and count, each named', () => {
    render(
      <KindChips value="all" counts={{ all: 22, comments: 12, actions: 10 }} onChange={vi.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'All 22' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    const comments = screen.getByRole('button', { name: 'Comments 12' });
    expect(comments.textContent).toBe('12');
    expect(screen.getByRole('button', { name: 'Actions 10' }).textContent).toBe('10');
  });

  it('narrows to the chip pressed', () => {
    const onChange = vi.fn();
    render(
      <KindChips value="all" counts={{ all: 2, comments: 1, actions: 1 }} onChange={onChange} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Actions 1' }));
    expect(onChange).toHaveBeenCalledWith('actions');
  });
});
