// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NameEditor } from './NameEditor';

afterEach(cleanup);

// A host that swaps the field back for its name button, as the title, a tab and a tab folder do.
function Host({ onRename = () => {} }: { onRename?: (name: string) => void }) {
  const [editing, setEditing] = useState(true);
  return (
    <div>
      {editing ? (
        <NameEditor
          initial="Plan"
          onCommit={(name) => {
            onRename(name);
            setEditing(false);
          }}
          onCancel={() => setEditing(false)}
          className=""
        />
      ) : (
        <button type="button" onClick={() => setEditing(true)}>
          Plan
        </button>
      )}
    </div>
  );
}

const frame = () =>
  act(() => new Promise<void>((resolve) => requestAnimationFrame(() => resolve())));

describe('NameEditor', () => {
  it('opens focused with the name selected', () => {
    render(<Host />);
    const field = screen.getByDisplayValue('Plan') as HTMLInputElement;
    expect(document.activeElement).toBe(field);
    expect([field.selectionStart, field.selectionEnd]).toEqual([0, 4]);
  });

  // Ended from the keyboard, the field goes and focus used to fall to the page.
  it.each(['Escape', 'Enter'])('hands focus to the name button when %s ends it', async (key) => {
    const onRename = vi.fn();
    render(<Host onRename={onRename} />);
    fireEvent.keyDown(screen.getByDisplayValue('Plan'), { key });
    await frame();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Plan' }));
    expect(onRename).toHaveBeenCalledTimes(key === 'Enter' ? 1 : 0);
  });

  it('leaves focus where a click put it', async () => {
    const other = document.createElement('button');
    document.body.appendChild(other);
    render(<Host />);
    other.focus();
    await frame();
    expect(document.activeElement).toBe(other);
    other.remove();
  });
});
