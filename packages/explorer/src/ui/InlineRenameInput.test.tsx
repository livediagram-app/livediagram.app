import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { InlineRenameInput } from './InlineRenameInput';

const rename = () => {
  const onCommit = vi.fn();
  const onCancel = vi.fn();
  render(
    <InlineRenameInput initial="Plan" onCommit={onCommit} onCancel={onCancel} ariaLabel="Name" />,
  );
  return { field: screen.getByLabelText('Name'), onCommit, onCancel };
};

describe('InlineRenameInput', () => {
  it('commits on Enter and cancels on Escape', () => {
    const { field, onCommit, onCancel } = rename();
    fireEvent.change(field, { target: { value: 'Roadmap' } });
    fireEvent.keyDown(field, { key: 'Enter' });
    expect(onCommit).toHaveBeenCalledWith('Roadmap');
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledOnce();
  });

  // design-principles.md: Enter picks an input method's conversion and Escape drops it; the rename stays open.
  it('leaves Enter and Escape to an input method composing a word', () => {
    const { field, onCommit, onCancel } = rename();
    fireEvent.change(field, { target: { value: 'にほん' } });
    fireEvent.keyDown(field, { key: 'Enter', isComposing: true });
    fireEvent.keyDown(field, { key: 'Escape', isComposing: true });
    fireEvent.keyDown(field, { key: 'Enter', keyCode: 229 });
    expect(onCommit).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});
