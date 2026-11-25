// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { useEffect, useRef, useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { usePopoverLayer } from '../popover-stack';
import { useFocusTrap } from '../useFocusTrap';
import { ToastProvider, useToast, type ToastApi } from './ToastProvider';
import { TOAST_REACH_KEY } from './ToastStack';

// liveworkspace/docs/specs/016-notifications/toasts.md "Keyboard and screen readers" and
// liveworkspace/docs/specs/022-interface-design/undo-not-confirm.md: F6 reaches the newest toast's action from inside a
// focus-trapping popover, focus goes back once it is answered, and an Escape that closes a panel never closes a toast.

let api: ToastApi;
function Grab() {
  const toast = useToast();
  useEffect(() => {
    api = toast;
  }, [toast]);
  return null;
}

// A popover that keeps Tab inside itself and closes on Escape, as Tools and the Layers drawer do.
function Trapped({ onClose }: { onClose: () => void }) {
  const panel = useRef<HTMLDivElement>(null);
  useFocusTrap(panel);
  usePopoverLayer(panel, (e) => {
    if (e.key === 'Escape') onClose();
  });
  return (
    <div ref={panel} role="dialog" aria-label="Tools" tabIndex={-1}>
      <button type="button">Delete Slide</button>
      <button type="button">Present</button>
    </div>
  );
}

function Page() {
  const [open, setOpen] = useState(true);
  return open ? <Trapped onClose={() => setOpen(false)} /> : <p>Closed</p>;
}

afterEach(cleanup);

function setup() {
  render(
    <ToastProvider>
      <Grab />
      <Page />
    </ToastProvider>,
  );
  const undo = vi.fn();
  act(() =>
    api.action({
      key: 'undo:1',
      message: 'Deleted “Roadmap”.',
      important: true,
      actions: [{ label: 'Undo', ariaLabel: 'Undo deleting Roadmap', onSelect: undo }],
    }),
  );
  const from = screen.getByRole('button', { name: 'Delete Slide' });
  from.focus();
  return { undo, from };
}
const press = (key: string, shiftKey = false) =>
  fireEvent.keyDown(document.activeElement ?? document.body, { key, shiftKey });

describe('reaching a toast from the keyboard', () => {
  it('says how to reach its action', () => {
    setup();
    expect(screen.getByRole('status').textContent).toContain(
      `Press ${TOAST_REACH_KEY} to reach Undo.`,
    );
  });

  it('moves focus from inside a trapped popover to Undo, and back once Undo is pressed', () => {
    const { undo, from } = setup();
    press(TOAST_REACH_KEY);
    const button = screen.getByRole('button', { name: 'Undo deleting Roadmap' });
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    expect(undo).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(from);
  });

  it('closes the toast on Escape from inside it, leaving the popover open, and hands focus back', () => {
    const { undo, from } = setup();
    press(TOAST_REACH_KEY);
    press('Escape');
    expect(undo).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Tools' })).toBeTruthy();
    expect(document.activeElement).toBe(from);
    // Leaving: hidden from the accessibility tree.
    expect(screen.queryByRole('button', { name: 'Undo deleting Roadmap' })).toBeNull();
  });

  it('keeps the toast when Escape closes the popover', () => {
    setup();
    press('Escape');
    expect(screen.getByText('Closed')).toBeTruthy();
    const button = screen.getByRole('button', { name: 'Undo deleting Roadmap' });
    expect(button.closest('[aria-hidden]')).toBeNull();
    // Still reachable once the popover has gone.
    press(TOAST_REACH_KEY);
    expect(document.activeElement).toBe(button);
  });

  it('leaves F6 alone while no toast has an action, and once focus is in the toast', () => {
    render(
      <ToastProvider>
        <Grab />
        <button type="button">Elsewhere</button>
      </ToastProvider>,
    );
    act(() => api.info('Saved.'));
    const here = screen.getByRole('button', { name: 'Elsewhere' });
    here.focus();
    expect(press(TOAST_REACH_KEY)).toBe(true);
    expect(document.activeElement).toBe(here);
  });
});
