// @vitest-environment jsdom

import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape } from '@liveplanner/document';
import { RichTextEditor } from './RichTextEditor';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/008-canvas/canvas-and-palette.md "Labels": Escape keeps what you typed. It commits and leaves, as a
// click away does, and never cancels: it is how people finish typing on a canvas.

afterEach(cleanup);

describe('RichTextEditor Escape', () => {
  it('commits the typed label instead of cancelling it', () => {
    const onCommit = vi.fn();
    const onCancel = vi.fn();
    const { container } = render(
      <RichTextEditor
        element={createShape('square', 0, 0)}
        initialLabel=""
        placeholder="Label"
        textSize="md"
        alignX="center"
        alignY="middle"
        padding="normal"
        multiline
        cursorAtEnd
        onCommit={onCommit}
        onCancel={onCancel}
      />,
    );
    const editor = container.querySelector<HTMLElement>('[contenteditable]')!;
    act(() => {
      editor.textContent = 'Start';
      editor.dispatchEvent(new Event('input', { bubbles: true }));
    });
    fireEvent.keyDown(editor, { key: 'Escape' });
    expect(onCommit).toHaveBeenCalledWith('Start', expect.any(Array));
    expect(onCancel).not.toHaveBeenCalled();
  });
});
