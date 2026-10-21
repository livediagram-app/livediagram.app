// @vitest-environment jsdom

// The note editor (docs/specs/009-elements/rich-text-notes.md): it opens painted with the note's runs,
// focused, with the caret parked at the end; a format apply repaints the runs and reports the new
// value up in the same tick.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TextRun } from '@livediagram/document';
import { NoteRichTextEditor } from './NoteRichTextEditor';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

afterEach(() => cleanup());

function editor(runs: TextRun[], onChange = vi.fn()) {
  render(
    <NoteRichTextEditor
      initialRuns={runs}
      onChange={onChange}
      onSubmit={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  return { surface: screen.getByRole('textbox', { name: 'Note' }), onChange };
}

describe('NoteRichTextEditor', () => {
  it('opens painted, focused, with the caret at the end', () => {
    const { surface } = editor([{ text: 'Hello ' }, { text: 'world', bold: true }]);
    expect(surface.textContent).toBe('Hello world');
    const spans = surface.querySelectorAll('span');
    expect((spans[1] as HTMLElement).style.fontWeight).toBe('700');
    expect(document.activeElement).toBe(surface);
    const sel = window.getSelection()!;
    expect(sel.isCollapsed).toBe(true);
    const end = document.createRange();
    end.selectNodeContents(surface);
    end.collapse(false);
    expect(sel.getRangeAt(0).compareBoundaryPoints(Range.START_TO_START, end)).toBe(0);
  });

  it('repaints and reports a format apply over a selection', () => {
    const { surface, onChange } = editor([{ text: 'Hello' }]);
    const range = document.createRange();
    range.selectNodeContents(surface);
    window.getSelection()!.removeAllRanges();
    window.getSelection()!.addRange(range);
    act(() => {
      document.dispatchEvent(new Event('selectionchange'));
    });
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(onChange).toHaveBeenLastCalledWith('Hello', [{ text: 'Hello', bold: true }]);
    expect((surface.querySelector('span') as HTMLElement).style.fontWeight).toBe('700');
    expect(screen.getByRole('button', { name: 'Bold' }).getAttribute('aria-pressed')).toBe('true');
  });
});
