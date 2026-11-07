// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { StackModal } from './StackModal';

// A stack's modal (docs/specs/017-telemetry/telemetry.md "Chart stacks") is portalled to <body>, outside the
// page's `data-app` scope, so it copies the head's scope to wear the current app's accent (Work Tracker #588).
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let root: Root | null = null;
let host: HTMLElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function open(scope: string | null, onClose = vi.fn()) {
  host = document.createElement('div');
  if (scope) host.setAttribute('data-app', scope);
  const anchor = document.createElement('button');
  host.appendChild(anchor);
  document.body.appendChild(host);
  const mount = document.createElement('div');
  host.appendChild(mount);
  root = createRoot(mount);
  act(() =>
    root!.render(
      <StackModal
        anchor={anchor}
        title="Onboarding"
        subtitle="4 charts"
        count={4}
        onClose={onClose}
        footer={<a href="#features">See Each Tour in Features</a>}
      >
        <p>member</p>
      </StackModal>,
    ),
  );
  const dialog = document.body.querySelector<HTMLElement>('[role="dialog"]')!;
  return { anchor, dialog, onClose };
}

describe('StackModal', () => {
  it.each(['livehuddle.app', 'livedesign.app', 'livediagram.app'])(
    "takes %s's app scope though it is portalled to the body",
    (app) => {
      const { dialog } = open(app);
      expect(host!.contains(dialog)).toBe(false);
      expect(dialog.closest('[data-app]')?.getAttribute('data-app')).toBe(app);
      expect(dialog.textContent).toContain('See Each Tour in Features');
    },
  );

  it('adds no scope when the head sits outside one', () => {
    const { dialog } = open(null);
    expect(dialog.closest('[data-app]')).toBeNull();
  });

  it('closes on a press on the dim, not inside the modal, and hands focus back to the head', () => {
    const { anchor, dialog, onClose } = open('livehuddle.app');
    expect(document.activeElement).toBe(dialog);
    act(() => {
      dialog.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(onClose).not.toHaveBeenCalled();
    act(() => {
      dialog.parentElement!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => root?.unmount());
    root = null;
    expect(document.activeElement).toBe(anchor);
  });
});
