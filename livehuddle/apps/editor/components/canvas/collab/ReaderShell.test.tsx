// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
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
