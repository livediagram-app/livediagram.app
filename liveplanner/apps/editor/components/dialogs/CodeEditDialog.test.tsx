// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CodeEditDialog } from './CodeEditDialog';

// docs/specs/009-elements/code-block.md: Tab indents, yet a keyboard can still leave the field and save.
describe('CodeEditDialog from the keyboard', () => {
  const open = () => {
    const onCommit = vi.fn();
    const onClose = vi.fn();
    const onSetWrap = vi.fn();
    render(
      <CodeEditDialog
        code="a"
        language="ts"
        wrap
        onSetWrap={onSetWrap}
        onCommit={onCommit}
        onClose={onClose}
      />,
    );
    return { onCommit, onClose, onSetWrap, field: screen.getByRole('textbox', { name: 'Code' }) };
  };

  it('indents on Tab', () => {
    const { field } = open();
    (field as HTMLTextAreaElement).setSelectionRange(1, 1);
    const tab = fireEvent.keyDown(field, { key: 'Tab' });
    expect(tab).toBe(false);
    expect((field as HTMLTextAreaElement).value).toBe('a  ');
  });

  it('leaves the field on Shift+Tab rather than indenting', () => {
    const { field } = open();
    field.focus();
    fireEvent.keyDown(field, { key: 'Tab', shiftKey: true });
    expect((field as HTMLTextAreaElement).value).toBe('a');
  });

  it('saves on Cmd or Ctrl+Enter, and says so', () => {
    const { field, onCommit, onClose } = open();
    fireEvent.change(field, { target: { value: 'b' } });
    fireEvent.keyDown(field, { key: 'Enter', ctrlKey: true });
    expect(onCommit).toHaveBeenCalledWith('b', 'ts');
    expect(onClose).toHaveBeenCalled();
    const hint = document.getElementById(field.getAttribute('aria-describedby')!);
    expect(hint?.textContent).toMatch(/Enter saves/);
  });

  // code-block.md: Wrap Long Lines is the dialog's, saved with the code and only when it changed.
  it('saves Wrap Long Lines with the code, only when it changed', () => {
    const kept = open();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(kept.onSetWrap).not.toHaveBeenCalled();
    cleanup();
    const changed = open();
    fireEvent.click(screen.getByRole('checkbox', { name: 'Wrap Long Lines' }));
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(changed.onSetWrap).toHaveBeenCalledWith(false);
  });
});
