// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type MindOutlineSummary, type ShapeElement } from '@livediagram/document';
import { MindOutlineDialog } from './MindOutlineDialog';

// The Edit Outline dialog (docs/specs/009-elements/mind-node.md "Edit Outline").

const node = (label: string) => ({ ...createShape('mind-node', 0, 0), label }) as ShapeElement;
const none: MindOutlineSummary = { added: 0, renamed: 0, moved: 0, removed: [] };

function open(summary: MindOutlineSummary = none, initialText = 'Root\n- A\n- B') {
  const onSave = vi.fn();
  const onClose = vi.fn();
  render(
    <MindOutlineDialog
      initialText={initialText}
      summarise={() => summary}
      onSave={onSave}
      onClose={onClose}
    />,
  );
  return { onSave, onClose, area: screen.getByRole('textbox', { name: 'Outline' }) };
}

afterEach(cleanup);

describe('MindOutlineDialog', () => {
  it('opens on the map written out, saying what Save will do', () => {
    const { area } = open({ ...none, added: 2, renamed: 1 });
    expect((area as HTMLTextAreaElement).value).toBe('Root\n- A\n- B');
    expect(screen.getByText('2 added, 1 renamed')).toBeTruthy();
  });

  it('indents the line the caret is on with Tab, and outdents it with Shift+Tab', () => {
    const { area } = open();
    const el = area as HTMLTextAreaElement;
    el.setSelectionRange(9, 9); // on "- B"
    fireEvent.keyDown(el, { key: 'Tab' });
    expect(el.value).toBe('Root\n- A\n  - B');
    el.setSelectionRange(12, 12);
    fireEvent.keyDown(el, { key: 'Tab', shiftKey: true });
    expect(el.value).toBe('Root\n- A\n- B');
  });

  it('saves with Cmd/Ctrl+Enter', () => {
    const { area, onSave, onClose } = open({ ...none, added: 1 });
    fireEvent.keyDown(area, { key: 'Enter', metaKey: true });
    expect(onSave).toHaveBeenCalledWith('Root\n- A\n- B');
    expect(onClose).toHaveBeenCalled();
  });

  it('asks before removing nodes, naming them, and Keep Editing goes back', () => {
    const { onSave } = open({ ...none, removed: [node('Old idea')] });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog', { name: 'Remove 1 node?' }).textContent).toContain(
      '“Old idea” will go, with its connectors',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Keep Editing' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove' }));
    expect(onSave).toHaveBeenCalled();
  });

  it('cannot save an outline with no lines', () => {
    const { area } = open();
    fireEvent.change(area, { target: { value: '   \n' } });
    expect(screen.getByText('Write at least the root')).toBeTruthy();
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
