// @vitest-environment jsdom
// The Timer length (docs/specs/009-elements/timer-and-stopwatch.md "The controls"): a popover hung from Set on a
// desktop, a drawer from the screen's foot on a phone (liveworkspace/docs/specs/011-workbench/phone-drawers.md), its
// targets a thumb's size there; the same presets, field and Set Timer in both.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TimerLengthPopover } from './TimerLengthPopover';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function phone(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    (query: string) =>
      ({
        matches,
        media: query,
        addEventListener: () => undefined,
        removeEventListener: () => undefined,
        addListener: () => undefined,
        removeListener: () => undefined,
      }) as unknown as MediaQueryList,
  );
}

function open() {
  const anchor = document.createElement('button');
  document.body.appendChild(anchor);
  const onSet = vi.fn();
  const onClose = vi.fn();
  render(<TimerLengthPopover anchor={anchor} minutes={10} onSet={onSet} onClose={onClose} />);
  return { onSet, onClose, dialog: screen.getByRole('dialog', { name: 'Timer length' }) };
}

describe('TimerLengthPopover', () => {
  it('is a drawer on a phone, with thumb-sized targets, and sets the length', () => {
    phone(true);
    const { dialog, onSet, onClose } = open();
    expect(dialog.hasAttribute('data-popover-sheet')).toBe(true);
    expect(dialog.querySelector('[data-sheet-handle]')).not.toBeNull();
    const preset = screen.getByRole('button', { name: '25 min' });
    expect(preset.className).toContain('h-10');
    expect(screen.getByRole('button', { name: 'One minute more' }).className).toContain('w-10');
    fireEvent.click(preset);
    fireEvent.click(screen.getByRole('button', { name: 'Set Timer' }));
    expect(onSet).toHaveBeenCalledWith(25);
    fireEvent.click(dialog.previousElementSibling as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('is the popover hung from Set on a desktop', () => {
    phone(false);
    const { dialog, onSet } = open();
    expect(dialog.hasAttribute('data-popover-sheet')).toBe(false);
    expect(dialog.querySelector('[data-sheet-handle]')).toBeNull();
    expect(screen.getByRole('button', { name: '5 min' }).className).toContain('py-1');
    expect(screen.getByRole('button', { name: 'One minute less' }).className).toContain('w-8');
    fireEvent.click(screen.getByRole('button', { name: 'One minute less' }));
    fireEvent.click(screen.getByRole('button', { name: 'Set Timer' }));
    expect(onSet).toHaveBeenCalledWith(9);
  });
});
