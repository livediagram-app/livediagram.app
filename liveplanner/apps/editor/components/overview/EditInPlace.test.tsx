// @vitest-environment jsdom

// The name and description edited in place (docs/specs/026-plan/plan-overview.md "Editing in place").
import { useState } from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PROJECT_DESCRIPTION_MAX } from '@liveplanner/api-schema';
import { NAME_MAX_LENGTH } from '@liveworkspace/model-core/names';
import { DESCRIPTION_COUNT_FROM, EditInPlace } from './EditInPlace';

afterEach(cleanup);

// Holds `editing` as OverviewHeader does.
function Harness({
  kind,
  value,
  onSave,
}: {
  kind: 'name' | 'description';
  value: string;
  onSave: (v: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const isName = kind === 'name';
  return (
    <EditInPlace
      kind={kind}
      as={isName ? 'h1' : 'p'}
      textClass=""
      value={value}
      label={isName ? 'Rename' : 'Edit Description'}
      fieldLabel={isName ? 'Plan Name' : 'Description'}
      maxLength={isName ? NAME_MAX_LENGTH : PROJECT_DESCRIPTION_MAX}
      editing={editing}
      onStart={() => setEditing(true)}
      onEnd={() => setEditing(false)}
      onSave={onSave}
    />
  );
}

function setup(
  kind: 'name' | 'description',
  value = kind === 'name' ? 'Bug Triage' : 'Where bugs land.',
) {
  const onSave = vi.fn();
  render(<Harness kind={kind} value={value} onSave={onSave} />);
  const start = screen.getByRole('button', {
    name: kind === 'name' ? 'Rename' : 'Edit Description',
  });
  const field = () =>
    screen.getByRole<HTMLTextAreaElement>('textbox', {
      name: kind === 'name' ? 'Plan Name' : 'Description',
    });
  return { onSave, start, field };
}

describe('Editing the name in place', () => {
  it('starts on a click, with the name selected, and saves the trimmed name on Enter', () => {
    const { onSave, start, field } = setup('name');
    fireEvent.click(start);
    expect(document.activeElement).toBe(field());
    expect(field().selectionStart).toBe(0);
    expect(field().selectionEnd).toBe('Bug Triage'.length);
    fireEvent.change(field(), { target: { value: '  Bugs  ' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(onSave).toHaveBeenCalledWith('Bugs');
    expect(screen.queryByRole('textbox')).toBeNull();
    // Ended by a key: focus goes back to where it started.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Rename' }));
  });

  it('starts on Enter or F2 while focused', () => {
    for (const key of ['Enter', 'F2']) {
      const { start, field } = setup('name');
      fireEvent.keyDown(start, { key });
      expect(field()).toBeTruthy();
      cleanup();
    }
  });

  it('saves once when left, and puts the name back on Escape', () => {
    const { onSave, start, field } = setup('name');
    fireEvent.click(start);
    fireEvent.change(field(), { target: { value: 'Bugs' } });
    fireEvent.blur(field());
    expect(onSave).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    fireEvent.change(field(), { target: { value: 'Something else' } });
    fireEvent.keyDown(field(), { key: 'Escape' });
    // The blur that follows a finished edit saves nothing.
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Bug Triage');
  });

  it('refuses an empty name and saves nothing unchanged', () => {
    const { onSave, start, field } = setup('name');
    fireEvent.click(start);
    fireEvent.change(field(), { target: { value: '   ' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    fireEvent.click(screen.getByRole('button', { name: 'Rename' }));
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(onSave).not.toHaveBeenCalled();
  });

  it('keeps a name on one line and caps it as names are', () => {
    const { onSave, start, field } = setup('name');
    fireEvent.click(start);
    expect(field().maxLength).toBe(NAME_MAX_LENGTH);
    fireEvent.change(field(), { target: { value: 'Bug\nTriage' } });
    expect(field().value).toBe('Bug Triage');
    fireEvent.change(field(), { target: { value: 'Bug\r\nBoard' } });
    fireEvent.keyDown(field(), { key: 'Enter' });
    expect(onSave).toHaveBeenCalledWith('Bug Board');
  });

  it('keeps every key off the editor', () => {
    const outer = vi.fn();
    document.addEventListener('keydown', outer);
    const { start, field } = setup('name');
    fireEvent.click(start);
    fireEvent.keyDown(field(), { key: 'd' });
    fireEvent.keyDown(field(), { key: 'Escape' });
    document.removeEventListener('keydown', outer);
    expect(outer).not.toHaveBeenCalled();
  });
});

describe('Editing the description in place', () => {
  it('takes new lines on Enter and saves on Cmd or Ctrl + Enter', () => {
    for (const mod of [{ metaKey: true }, { ctrlKey: true }]) {
      const { onSave, start, field } = setup('description');
      fireEvent.click(start);
      // The caret goes to the end.
      expect(field().selectionStart).toBe('Where bugs land.'.length);
      fireEvent.keyDown(field(), { key: 'Enter' });
      expect(field()).toBeTruthy();
      fireEvent.change(field(), { target: { value: ' Where bugs land.\nAnd get fixed. ' } });
      fireEvent.keyDown(field(), { key: 'Enter', ...mod });
      expect(onSave).toHaveBeenCalledWith('Where bugs land.\nAnd get fixed.');
      expect(screen.queryByRole('textbox')).toBeNull();
      cleanup();
    }
  });

  it('saves when left, and puts it back on Escape', () => {
    const { onSave, start, field } = setup('description');
    fireEvent.click(start);
    fireEvent.change(field(), { target: { value: 'Changed' } });
    fireEvent.keyDown(field(), { key: 'Escape' });
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Edit Description' }));
    fireEvent.change(field(), { target: { value: '' } });
    fireEvent.blur(field());
    // A description may be emptied.
    expect(onSave).toHaveBeenCalledWith('');
  });

  it('caps the description and counts once past 400', () => {
    const { start, field } = setup('description', 'x'.repeat(DESCRIPTION_COUNT_FROM));
    fireEvent.click(start);
    expect(field().maxLength).toBe(PROJECT_DESCRIPTION_MAX);
    expect(screen.queryByText(/\/ 500/)).toBeNull();
    fireEvent.change(field(), { target: { value: 'x'.repeat(DESCRIPTION_COUNT_FROM + 1) } });
    const count = screen.getByText(`${DESCRIPTION_COUNT_FROM + 1} / ${PROJECT_DESCRIPTION_MAX}`);
    expect(field().getAttribute('aria-describedby')).toBe(count.id);
  });
});
