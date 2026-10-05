// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

// The shared dialog shell (docs/specs/007-editor/live-app.md "A dialog closes from the backdrop
// only on a press that starts there").

afterEach(cleanup);

function open() {
  const onClose = vi.fn();
  render(
    <Dialog open onClose={onClose} ariaLabel="Test">
      <p>Body</p>
    </Dialog>,
  );
  const panel = screen.getByRole('dialog');
  return { onClose, panel, backdrop: panel.parentElement! };
}

describe('Dialog backdrop', () => {
  it('closes on a press that starts and ends on the backdrop', () => {
    const { onClose, backdrop } = open();
    fireEvent.pointerDown(backdrop);
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('stays open when a drag from inside the panel is released over the backdrop', () => {
    const { onClose, panel, backdrop } = open();
    fireEvent.pointerDown(panel);
    fireEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });
});
