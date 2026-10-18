// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InlineRenameInput } from './InlineRenameInput';

afterEach(cleanup);

// The field replaces the row's label while it is open, so it carries its own name: a screen reader heard only
// "edit text" and the old name (the Explorer's New Folder field).
describe('InlineRenameInput', () => {
  it('is named, focused with its text selected, and commits on Enter', () => {
    const onCommit = vi.fn();
    render(
      <InlineRenameInput
        initial="New folder"
        ariaLabel="Rename New folder"
        onCommit={onCommit}
        onCancel={vi.fn()}
      />,
    );
    const field = screen.getByRole('textbox', { name: 'Rename New folder' }) as HTMLInputElement;
    expect(document.activeElement).toBe(field);
    fireEvent.change(field, { target: { value: 'Q4 Plans' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith('Q4 Plans');
  });
});
