// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useAvatarActionKeys } from '@livehuddle/avatar/hooks/useAvatarActionKeys';
import { NO_KEYS_HELD, useAvatarKeys } from '@livehuddle/avatar/hooks/useAvatarKeys';
import { walkInputBlocked } from '@livehuddle/avatar/walk-guard';
import { ReaderShell } from './ReaderShell';

afterEach(cleanup);

describe('the reader (docs/specs/008-canvas/avatar-mode.md "The reader")', () => {
  it("puts a subtitle under the title and a footer in the dialog's action row", () => {
    render(
      <ReaderShell
        title="Kitchen"
        subtitle={<span>In Use</span>}
        footer={<button type="button">Knock</button>}
        onClose={() => {}}
      >
        <p>Body</p>
      </ReaderShell>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Kitchen' });
    expect(within(dialog).getByText('In Use')).toBeTruthy();
    const knock = within(dialog).getByRole('button', { name: 'Knock' });
    // Outside the scrolling body, so it stays put however long the body is.
    expect(knock.closest('.overflow-y-auto')).toBeNull();
  });

  it("looks like every dialog: the dialog header's title and its close button", () => {
    const onClose = vi.fn();
    render(
      <ReaderShell title="Notice Board" onClose={onClose}>
        <p>Notes</p>
      </ReaderShell>,
    );
    const dialog = screen.getByRole('dialog', { name: 'Notice Board' });
    expect(dialog.className).toContain('rounded-xl');
    expect(dialog.className).toContain('border-slate-200');
    expect(screen.getByRole('heading', { level: 2, name: 'Notice Board' })).toBeTruthy();
    // The backdrop is a Close too (out of the tab order); this is the header's.
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the Screen's dark bar, its Close labelled", () => {
    const onClose = vi.fn();
    render(
      <ReaderShell title="Screen" tone="dark" onClose={onClose}>
        <p>Video</p>
      </ReaderShell>,
    );
    expect(screen.queryByRole('heading', { level: 2 })).toBeNull();
    const close = within(screen.getByRole('dialog', { name: 'Screen' })).getByRole('button', {
      name: 'Close',
    });
    expect(close.textContent).toContain('Close');
    fireEvent.click(close);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Escape closes it', () => {
    const onClose = vi.fn();
    render(
      <ReaderShell title="World Clock" onClose={onClose}>
        <p>Times</p>
      </ReaderShell>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});

// The walk behind it (Work Tracker 629): the arrows steer and the action keys (W waves) act through the avatar's own
// hooks, live here as they are in Avatar mode, with a reader open over them or not.
function Walk({ reader, onMove }: { reader: boolean; onMove: (what: string) => void }) {
  const held = useRef(NO_KEYS_HELD);
  const [text, setText] = useState('');
  useAvatarKeys({
    active: true,
    heldRef: held,
    onSteer: () => onMove('steer'),
    onJump: () => onMove('jump'),
  });
  useAvatarActionKeys({
    active: true,
    onReaction: (kind) => onMove(kind),
    onBurst: () => onMove('burst'),
  });
  return reader ? (
    <ReaderShell title="Notice Board" onClose={() => {}}>
      <input aria-label="Add a note" value={text} onChange={(e) => setText(e.target.value)} />
    </ReaderShell>
  ) : null;
}

describe('a reader holds the keyboard (docs/specs/008-canvas/avatar-mode.md "The reader")', () => {
  const press = (key: string, code = key) => {
    fireEvent.keyDown(window, { key, code });
    fireEvent.keyUp(window, { key, code });
  };

  it('walks with no reader open: the control for the test below', () => {
    const onMove = vi.fn();
    render(<Walk reader={false} onMove={onMove} />);
    expect(walkInputBlocked()).toBe(false);
    press('ArrowUp');
    press('w', 'KeyW');
    expect(onMove).toHaveBeenCalledWith('steer');
    expect(onMove).toHaveBeenCalledWith('wave');
  });

  it('with a reader open, no arrow, W/A/S/D or Space moves anything behind it, and closing it frees them', () => {
    const onMove = vi.fn();
    const view = render(<Walk reader onMove={onMove} />);
    expect(walkInputBlocked()).toBe(true);
    for (const key of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) press(key);
    for (const key of ['w', 'a', 's', 'd']) press(key, `Key${key.toUpperCase()}`);
    press(' ', 'Space');
    expect(onMove).not.toHaveBeenCalled();
    view.rerender(<Walk reader={false} onMove={onMove} />);
    expect(walkInputBlocked()).toBe(false);
    press('ArrowLeft');
    expect(onMove).toHaveBeenCalledWith('steer');
  });

  it("still types in a field inside the reader, and the walk doesn't hear it", () => {
    const onMove = vi.fn();
    render(<Walk reader onMove={onMove} />);
    const field = screen.getByRole('textbox', { name: 'Add a note' });
    fireEvent.keyDown(field, { key: 'w', code: 'KeyW' });
    fireEvent.change(field, { target: { value: 'wasd' } });
    expect((field as HTMLInputElement).value).toBe('wasd');
    expect(onMove).not.toHaveBeenCalled();
  });
});
