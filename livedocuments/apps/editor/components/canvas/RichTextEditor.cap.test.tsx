// @vitest-environment jsdom

import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createShape, type ShapeElement } from '@livedocuments/document';
import { renderLabel } from './element-labels';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// docs/specs/009-elements/badge.md "The element": the editor stops taking text at a badge's or step's cap; a paste is
// cut to fit, and Enter adds nothing to a full label.

afterEach(cleanup);

function edit(kind: 'step' | 'badge' | 'square', label: string) {
  const onCommit = vi.fn();
  const element: ShapeElement = { ...createShape(kind, 0, 0), label };
  const { container } = render(
    <>
      {renderLabel(element, label, 'md', 'center', 'middle', 8, true, onCommit, () => {}, true)}
    </>,
  );
  const editor = container.querySelector<HTMLElement>('[contenteditable]')!;
  act(() => {
    editor.focus();
    const range = document.createRange();
    range.selectNodeContents(editor);
    range.collapse(false);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
  });
  const paste = (text: string) => fireEvent.paste(editor, { clipboardData: { getData: () => text } });
  const commit = () => fireEvent.keyDown(editor, { key: 'Escape' });
  return { editor, onCommit, paste, commit };
}

describe('RichTextEditor cap', () => {
  it('cuts a paste into a step to its 3 characters', () => {
    const { onCommit, paste, commit } = edit('step', '1');
    paste('23456');
    commit();
    expect(onCommit).toHaveBeenCalledWith('123', expect.any(Array));
  });

  it('cuts a paste into a badge to its 24 characters', () => {
    const { onCommit, paste, commit } = edit('badge', 'New');
    paste('x'.repeat(40));
    commit();
    expect(onCommit).toHaveBeenCalledWith(`New${'x'.repeat(21)}`, expect.any(Array));
  });

  it('adds no new line to a full label', () => {
    const { editor, onCommit, commit } = edit('step', '123');
    fireEvent.keyDown(editor, { key: 'Enter' });
    commit();
    expect(onCommit).toHaveBeenCalledWith('123', expect.any(Array));
  });

  it('leaves a label with no cap uncut', () => {
    const { onCommit, paste, commit } = edit('square', '');
    paste('y'.repeat(40));
    commit();
    expect(onCommit).toHaveBeenCalledWith('y'.repeat(40), expect.any(Array));
  });
});
