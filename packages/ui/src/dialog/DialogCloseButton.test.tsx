// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DialogCloseButton } from './DialogCloseButton';
import { DialogDismissContext } from './dialog-dismiss';

// liveworkspace/docs/specs/022-interface-design/close-button.md: the one circled X every modal and drawer wears.
describe('DialogCloseButton', () => {
  it('is a 44px circle named Close that closes at once outside a sheet', () => {
    const onClick = vi.fn();
    render(<DialogCloseButton onClick={onClick} />);
    const close = screen.getByRole('button', { name: 'Close' });
    expect(close.className).toMatch(/\bsize-11\b/);
    expect(close.className).toMatch(/\brounded-full\b/);
    expect(close.className).toMatch(/\bcursor-pointer\b/);
    fireEvent.click(close);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('takes the name of what it closes', () => {
    render(<DialogCloseButton label="Close Version History" onClick={() => {}} />);
    expect(screen.getByRole('button', { name: 'Close Version History' })).toBeTruthy();
  });

  it('reads on a dark bar in its dark tone', () => {
    render(<DialogCloseButton tone="dark" onClick={() => {}} />);
    const c = screen.getByRole('button', { name: 'Close' }).className;
    expect(c).toMatch(/\bbg-white\/10\b/);
    expect(c).toMatch(/\btext-white\b/);
    expect(c).not.toMatch(/bg-slate-900/);
  });

  it('closes through the sheet, which slides out before the handler runs', () => {
    const onClick = vi.fn();
    const later: Array<() => void> = [];
    render(
      <DialogDismissContext.Provider value={(then) => later.push(then)}>
        <DialogCloseButton onClick={onClick} />
      </DialogDismissContext.Provider>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClick).not.toHaveBeenCalled();
    later[0]!();
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
