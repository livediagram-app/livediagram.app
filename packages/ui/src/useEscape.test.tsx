// @vitest-environment jsdom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useEscape } from './useEscape';

function Surface({ onEscape, preventDefault }: { onEscape: () => void; preventDefault?: boolean }) {
  useEscape(onEscape, preventDefault === undefined ? {} : { preventDefault });
  return null;
}

const press = () => {
  const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  document.dispatchEvent(e);
  return e;
};

// One Escape does one thing: the surface that handles it claims it, so the editor's window-level shortcuts (which
// skip a claimed key) never leave Avatar mode or clear a selection behind a dialog that just closed.
describe('useEscape', () => {
  afterEach(cleanup);

  it('fires and claims the key by default', () => {
    const onEscape = vi.fn();
    render(<Surface onEscape={onEscape} />);
    const e = press();
    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(e.defaultPrevented).toBe(true);
  });

  it('leaves the key unclaimed when asked to', () => {
    const onEscape = vi.fn();
    render(<Surface onEscape={onEscape} preventDefault={false} />);
    expect(press().defaultPrevented).toBe(false);
    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  // Escape while an input method composes drops its word: the dialog around the field stays open.
  it("leaves an input method's Escape alone", () => {
    const onEscape = vi.fn();
    render(<Surface onEscape={onEscape} />);
    for (const init of [{ isComposing: true }, { keyCode: 229 }]) {
      const e = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
        ...init,
      });
      document.dispatchEvent(e);
      expect(e.defaultPrevented).toBe(false);
    }
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('ignores other keys', () => {
    const onEscape = vi.fn();
    render(<Surface onEscape={onEscape} />);
    const e = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    document.dispatchEvent(e);
    expect(onEscape).not.toHaveBeenCalled();
    expect(e.defaultPrevented).toBe(false);
  });
});
