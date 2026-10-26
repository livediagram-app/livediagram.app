// @vitest-environment jsdom

import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, STEP_LABEL_MAX } from '@livediagram/document';
import { RichTextEditor } from './RichTextEditor';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/009-elements/badge.md "The element": the editor stops taking text at a badge's or step's cap; a paste is
// cut to fit, and Enter adds nothing to a full label.

afterEach(cleanup);

function editStep(initialLabel: string) {
  const onCommit = vi.fn();
  const { container } = render(
    <RichTextEditor
      element={createShape('step', 0, 0)}
      initialLabel={initialLabel}
      placeholder="1"
      textSize="md"
      alignX="center"
      alignY="middle"
      padding="normal"
      multiline={false}
      cursorAtEnd
      maxLength={STEP_LABEL_MAX}
      onCommit={onCommit}
      onCancel={() => {}}
    />,
  );
  const editor = container.querySelector<HTMLElement>('[contenteditable]')!;
  return { editor, onCommit };
}

describe('RichTextEditor cap', () => {
  it('cuts a paste to the room left', () => {
    const { editor, onCommit } = editStep('1');
    act(() => {
      editor.focus();
      const range = document.createRange();
      range.selectNodeContents(editor);
      range.collapse(false);
      window.getSelection()!.removeAllRanges();
      window.getSelection()!.addRange(range);
    });
    fireEvent.paste(editor, { clipboardData: { getData: () => '23456' } });
    fireEvent.keyDown(editor, { key: 'Escape' });
    expect(onCommit).toHaveBeenCalledWith('123', expect.any(Array));
  });

  it('adds no new line to a full label', () => {
    const { editor, onCommit } = editStep('123');
    fireEvent.keyDown(editor, { key: 'Enter' });
    fireEvent.keyDown(editor, { key: 'Escape' });
    expect(onCommit).toHaveBeenCalledWith('123', expect.any(Array));
  });
});
