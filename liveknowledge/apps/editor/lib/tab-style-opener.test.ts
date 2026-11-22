// @vitest-environment jsdom
// Tab Style's door on each page (docs/specs/011-theme/canvas-and-theme-dialog.md "Opening it").
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openTabStyleFrom, registerTabStyleOpen, tabStyleOpener } from './tab-style-opener';

let undo = () => {};
afterEach(() => {
  undo();
  document.body.innerHTML = '';
});

describe('the Tab Style opener', () => {
  it('opens through the registered door and remembers the button, briefly', () => {
    const open = vi.fn();
    undo = registerTabStyleOpen(open);
    const button = document.body.appendChild(document.createElement('button'));
    openTabStyleFrom(button);
    expect(open).toHaveBeenCalledTimes(1);
    expect(tabStyleOpener()).toBe(button);
    // Read twice (strict mode) it is still there; long after, it is not.
    expect(tabStyleOpener()).toBe(button);
    expect(tabStyleOpener(Date.now() + 5_000)).toBeNull();
  });

  it('forgets a button that left the page', () => {
    undo = registerTabStyleOpen(vi.fn());
    const button = document.body.appendChild(document.createElement('button'));
    openTabStyleFrom(button);
    button.remove();
    expect(tabStyleOpener()).toBeNull();
  });

  it('does nothing where nobody may style the tab (a Participant, a Viewer, an embed)', () => {
    undo = registerTabStyleOpen(null);
    const button = document.body.appendChild(document.createElement('button'));
    openTabStyleFrom(button);
    expect(tabStyleOpener()).toBeNull();
  });

  it("leaves a newer editor's door alone when an older one cleans up", () => {
    const older = registerTabStyleOpen(vi.fn());
    const newer = vi.fn();
    undo = registerTabStyleOpen(newer);
    older();
    openTabStyleFrom(null);
    expect(newer).toHaveBeenCalledTimes(1);
  });
});
