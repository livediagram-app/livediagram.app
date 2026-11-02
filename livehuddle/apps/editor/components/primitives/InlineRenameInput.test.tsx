// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InlineRenameInput } from './InlineRenameInput';

afterEach(cleanup);

// A row that swaps the field back for its link, as the Explorer's rows and folders do.
function Row() {
  const [editing, setEditing] = useState(true);
  return (
    <div>
      {editing ? (
        <InlineRenameInput
          initial="Roadmap"
          ariaLabel="Rename Roadmap"
          onCommit={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <a href="/document/x">Roadmap</a>
      )}
    </div>
  );
}

const frame = () =>
  act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

describe('InlineRenameInput', () => {
  // Ended from the keyboard, the field goes and focus used to fall to the page (refocus-after-field.ts).
  it.each(['Escape', 'Enter'])('hands focus to the row when %s ends it', async (key) => {
    render(<Row />);
    fireEvent.keyDown(screen.getByDisplayValue('Roadmap'), { key });
    await frame();
    expect(document.activeElement).toBe(screen.getByRole('link', { name: 'Roadmap' }));
  });

  // The field replaces the row's label while it is open, so it carries its own name: a screen reader heard only
  // "edit text" and the old name (the Explorer's New Folder field).
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
