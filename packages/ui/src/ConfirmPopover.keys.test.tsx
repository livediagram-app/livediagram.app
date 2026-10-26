// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfirmPopover } from './ConfirmPopover';

// docs/specs/007-editor/editor-app.md "Anchored popover": Enter confirms, but a focused button presses itself.

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

function open() {
  const anchor = document.createElement('button');
  document.body.appendChild(anchor);
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(
    <ConfirmPopover
      anchor={anchor}
      message="Delete this tab? It cannot be undone."
      confirmLabel="Delete"
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  );
  return { anchor, onConfirm, onCancel };
}

const enter = (target: EventTarget) => {
  const e = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  target.dispatchEvent(e);
  return e;
};

describe('ConfirmPopover Enter', () => {
  it('leaves Enter on a focused Cancel to the button, never confirming', () => {
    const { onConfirm } = open();
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    cancel.focus();
    const e = enter(cancel);
    expect(onConfirm).not.toHaveBeenCalled();
    // Not prevented, so the browser turns it into Cancel's click.
    expect(e.defaultPrevented).toBe(false);
  });

  it('confirms on Enter from outside its buttons', () => {
    const { anchor, onConfirm } = open();
    anchor.focus();
    const e = enter(anchor);
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(e.defaultPrevented).toBe(true);
  });
});
