// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useRef, useState } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
import { useFocusTrap } from './useFocusTrap';

// A modal keeps focus inside while open and gives it back to what opened it when it closes, including when it
// unmounts (by then its own controls have left the page and focus has fallen to <body>).

function Modal({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref);
  return (
    <div ref={ref} role="dialog" tabIndex={-1}>
      <button type="button">First</button>
      <button type="button" onClick={onClose}>
        Close
      </button>
    </div>
  );
}

function Page() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Report
      </button>
      <button type="button">Elsewhere</button>
      {open ? <Modal onClose={() => setOpen(false)} /> : null}
    </>
  );
}

afterEach(cleanup);

// jsdom has no layout, so every element reads offsetParent null; give buttons one so they count as visible.
Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
  configurable: true,
  get() {
    return this.parentNode;
  },
});

describe('useFocusTrap', () => {
  it('focuses the first control, wraps Tab, and gives focus back when the modal unmounts', () => {
    render(<Page />);
    const trigger = screen.getByRole('button', { name: 'Report' });
    trigger.focus();
    fireEvent.click(trigger);
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First' }));

    screen.getByRole('button', { name: 'Close' }).focus();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'First' }));

    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('leaves focus where the user has since put it', () => {
    function Closer() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <button type="button">Elsewhere</button>
          <button type="button" onClick={() => setOpen(false)}>
            Shut
          </button>
          {open ? <Modal onClose={() => setOpen(false)} /> : null}
        </>
      );
    }
    render(<Closer />);
    const opener = screen.getByRole('button', { name: 'Open' });
    opener.focus();
    fireEvent.click(opener);
    const elsewhere = screen.getByRole('button', { name: 'Elsewhere' });
    elsewhere.focus();
    fireEvent.click(screen.getByRole('button', { name: 'Shut' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    // Not pulled back to Open: the user had moved on.
    expect(document.activeElement).toBe(elsewhere);
  });

  it('keeps a field that took focus as the modal opened (autoFocus)', () => {
    function AutoModal() {
      const ref = useRef<HTMLDivElement>(null);
      useFocusTrap(ref);
      return (
        <div ref={ref} role="dialog" tabIndex={-1}>
          <button type="button">Close</button>
          <input aria-label="Title" autoFocus />
        </div>
      );
    }
    render(<AutoModal />);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Title' }));
  });
});
