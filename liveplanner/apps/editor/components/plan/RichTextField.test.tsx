// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { TextRun } from '@liveplanner/project';
import { RICH_TEXT_SAVE_MS, RichTextField } from './RichTextField';

// docs/specs/026-plan/plan-board.md "Working on a board": the panel's rich text, its saving and its limit. The note
// editor is its own suite's (NoteRichTextEditor.test.tsx): a text box stands in for it, reporting runs of what is typed.
vi.mock('@/components/notes/NoteRichTextEditor', () => ({
  NoteRichTextEditor: (p: {
    label: string;
    onChange: (plain: string, runs: TextRun[]) => void;
    onBlur: () => void;
  }) => (
    <textarea
      aria-label={p.label}
      onChange={(e) => p.onChange(e.target.value, [{ text: e.target.value, bold: true }])}
      onBlur={p.onBlur}
    />
  ),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function field(runs: TextRun[], maxLength?: number, onSave = vi.fn()) {
  render(
    <div>
      <RichTextField
        runs={runs}
        canEdit
        label="Steps"
        addPrompt="Add steps…"
        emptyText="None"
        placeholder="Write steps…"
        {...(maxLength === undefined ? {} : { maxLength })}
        onSave={onSave}
      />
      <button type="button">Elsewhere</button>
    </div>,
  );
  return onSave;
}

describe('RichTextField', () => {
  it('saves a moment after typing stops, then says Saved', () => {
    vi.useFakeTimers();
    const onSave = field([]);
    fireEvent.click(screen.getByRole('button', { name: /Add steps/ }));
    fireEvent.change(screen.getByLabelText('Steps'), { target: { value: 'Go' } });
    expect(screen.getByText('Saving…')).toBeTruthy();
    act(() => void vi.advanceTimersByTime(RICH_TEXT_SAVE_MS));
    expect(onSave).toHaveBeenCalledWith('Go', [{ text: 'Go', bold: true }]);
    expect(screen.getByText('Saved')).toBeTruthy();
  });

  it('opens on its text and its Edit button, and Escape returns it to reading', () => {
    const onSave = field([{ text: 'Open it' }]);
    fireEvent.click(screen.getByText('Open it'));
    fireEvent.change(screen.getByLabelText('Steps'), { target: { value: 'Open it now' } });
    fireEvent.keyDown(screen.getByLabelText('Steps'), { key: 'Escape' });
    expect(onSave).toHaveBeenCalledWith('Open it now', [{ text: 'Open it now', bold: true }]);
    expect(screen.queryByLabelText('Steps')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Edit the steps' }));
    expect(screen.getByLabelText('Steps')).toBeTruthy();
  });

  // docs/specs/004-interface-design/touch-targets.md: the Edit button is shown all the time where nothing hovers (and
  // on a phone), so it takes a finger's tap area there, and the text keeps clear of it rather than running under it.
  it('gives its Edit button a tap area and keeps the text clear of it on a touch screen', () => {
    field([{ text: 'Long enough to reach the button' }]);
    const edit = screen.getByRole('button', { name: 'Edit the steps' });
    expect(edit.className.split(' ')).toEqual(expect.arrayContaining(['absolute', 'touch-target']));
    const box = edit.parentElement!.className.split(' ');
    expect(box).toEqual(expect.arrayContaining(['max-sm:pr-16', '[@media(hover:none)]:pr-16']));
  });

  it('counts what is left near its limit, and saves nothing past it', () => {
    vi.useFakeTimers();
    const onSave = field([{ text: 'abcdefgh' }], 10);
    fireEvent.click(screen.getByRole('button', { name: 'Edit the steps' }));
    expect(screen.queryByText(/left/)).toBeNull();
    fireEvent.change(screen.getByLabelText('Steps'), { target: { value: 'abcdefghi' } });
    expect(screen.getByText('1 character left')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Steps'), { target: { value: 'abcdefghij' } });
    expect(screen.getByText('0 characters left')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Steps'), { target: { value: 'abcdefghijk' } });
    expect(screen.getByText('1 character over, not saved')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Steps'), { target: { value: 'abcdefghijklm' } });
    expect(screen.getByText('3 characters over, not saved')).toBeTruthy();
    act(() => void vi.advanceTimersByTime(RICH_TEXT_SAVE_MS));
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.blur(screen.getByLabelText('Steps'));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('reads plainly to someone who may only view', () => {
    render(
      <RichTextField
        runs={[]}
        canEdit={false}
        label="Steps"
        addPrompt="Add steps…"
        emptyText="None"
        placeholder=""
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText('None')).toBeTruthy();
    cleanup();
    render(
      <RichTextField
        runs={[{ text: 'Read me' }]}
        canEdit={false}
        label="Steps"
        addPrompt=""
        emptyText="None"
        placeholder=""
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText('Read me')).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
