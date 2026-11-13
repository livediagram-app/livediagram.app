// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { ConfirmPopover } from './ConfirmPopover';
import { usePopoverLayer } from './popover-stack';

// Tab stays in the top popover while focus is in it (docs/specs/004-interface-design/tooltips-hover-cards-popovers.md,
// liveplanner): a popover is portalled to the end of the page, outside the dialog it opened over, so Tab past its last
// control used to fall to the page body and on to the editor behind the modal.

// jsdom has no layout, so every element reads offsetParent null; give each one so it counts as visible.
const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent');
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get(this: HTMLElement) {
      return this.parentNode;
    },
  });
});
afterAll(() => {
  if (original) Object.defineProperty(HTMLElement.prototype, 'offsetParent', original);
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

const tab = (shift = false) => {
  const e = new KeyboardEvent('keydown', {
    key: 'Tab',
    shiftKey: shift,
    bubbles: true,
    cancelable: true,
  });
  (document.activeElement ?? document.body).dispatchEvent(e);
  return e;
};

function openConfirm() {
  const anchor = document.createElement('button');
  anchor.textContent = 'More';
  document.body.appendChild(anchor);
  render(
    <ConfirmPopover
      anchor={anchor}
      message="Delete this rule? Its runs stay."
      confirmLabel="Delete Rule"
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
    />,
  );
  return anchor;
}

describe('Tab in the top popover', () => {
  it('wraps from the last control to the first, and Shift+Tab back again', () => {
    openConfirm();
    const cancel = screen.getByRole('button', { name: 'Cancel' });
    const confirm = screen.getByRole('button', { name: 'Delete Rule' });
    confirm.focus();
    expect(tab().defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(cancel);
    expect(tab(true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(confirm);
  });

  it('leaves Tab between its own controls to the browser', () => {
    openConfirm();
    screen.getByRole('button', { name: 'Cancel' }).focus();
    expect(tab().defaultPrevented).toBe(false);
  });

  it('leaves focus outside the popover alone: a field driving its list keeps its Tab', () => {
    const anchor = openConfirm();
    anchor.focus();
    expect(tab().defaultPrevented).toBe(false);
    expect(document.activeElement).toBe(anchor);
  });

  it('wraps from something the browser lets Tab stop on after the last control (a scrolling list)', () => {
    function Panel() {
      const ref = useRef<HTMLDivElement>(null);
      usePopoverLayer(ref, () => {});
      return (
        <div ref={ref}>
          <input aria-label="Find a value" />
          <div data-testid="list" />
        </div>
      );
    }
    render(<Panel />);
    // A scroller the browser stops on, which the selectors do not count (focusable here through tabindex -1).
    const list = screen.getByTestId('list');
    list.tabIndex = -1;
    list.focus();
    expect(tab().defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Find a value' }));
    // Shift+Tab from the panel's only control stays on it.
    expect(tab(true).defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(screen.getByRole('textbox', { name: 'Find a value' }));
  });

  it('keeps focus where it is in a popover with nothing to Tab to', () => {
    function Empty() {
      const ref = useRef<HTMLDivElement>(null);
      usePopoverLayer(ref, () => {});
      return <div ref={ref} tabIndex={-1} data-testid="panel" />;
    }
    render(<Empty />);
    const panel = screen.getByTestId('panel');
    panel.focus();
    expect(tab().defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(panel);
  });

  it('leaves Tab alone when the popover took it itself', () => {
    function Taker() {
      const ref = useRef<HTMLDivElement>(null);
      usePopoverLayer(ref, (e) => {
        if (e.key === 'Tab') e.preventDefault();
      });
      return (
        <div ref={ref}>
          <button type="button">First</button>
          <button type="button">Last</button>
        </div>
      );
    }
    render(<Taker />);
    const last = screen.getByRole('button', { name: 'Last' });
    last.focus();
    tab();
    expect(document.activeElement).toBe(last);
  });

  it('leaves Tab to a control in the popover that takes it (a grid moving between cells)', () => {
    function Grid() {
      const ref = useRef<HTMLDivElement>(null);
      usePopoverLayer(ref, () => {});
      return (
        <div ref={ref}>
          <button type="button">First</button>
          <input
            aria-label="Cell"
            onKeyDown={(e) => {
              if (e.key === 'Tab') e.preventDefault();
            }}
          />
        </div>
      );
    }
    render(<Grid />);
    const cell = screen.getByRole('textbox', { name: 'Cell' });
    cell.focus();
    tab();
    expect(document.activeElement).toBe(cell);
  });

  it('keeps one listener waiting for the page, however many Tabs a handler stopped', () => {
    function Stopper() {
      const ref = useRef<HTMLDivElement>(null);
      usePopoverLayer(ref, () => {});
      return (
        <div ref={ref}>
          <button type="button">First</button>
          <input aria-label="Stops" onKeyDown={(e) => e.stopPropagation()} />
        </div>
      );
    }
    render(<Stopper />);
    const stops = screen.getByRole('textbox', { name: 'Stops' });
    stops.focus();
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    for (let i = 0; i < 5; i += 1) tab();
    const waiting = (spy: typeof add) =>
      spy.mock.calls.filter(([type, , options]) => type === 'keydown' && options !== true)
        .length;
    // Five added, the first four replaced by the next: one left waiting.
    expect(waiting(add) - waiting(remove)).toBe(1);
    add.mockRestore();
    remove.mockRestore();
  });
});
