// @vitest-environment jsdom
// The drawer a tool panel opens as on a phone (liveworkspace/docs/specs/011-workbench/phone-drawers.md): named, a scrim
// whose tap closes it without reaching what is under it, Escape (unless something it opened has focus), focus kept
// inside, the safe area, and out of sight while hidden.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PhoneDrawer } from './PhoneDrawer';

afterEach(cleanup);

// jsdom has no layout, so every element reads offsetParent null; give each one so the trap counts it as visible.
Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
  configurable: true,
  get(this: HTMLElement) {
    return this.parentNode;
  },
});

function drawer(props: Partial<Parameters<typeof PhoneDrawer>[0]> = {}) {
  const onClose = vi.fn();
  const view = render(
    <PhoneDrawer name="Layers" onClose={onClose} {...props}>
      <button type="button">First</button>
      <button type="button">Last</button>
    </PhoneDrawer>,
  );
  const sheet = screen.getByRole('dialog', { name: 'Layers' });
  const scrim = sheet.previousElementSibling as HTMLElement;
  return { onClose, view, sheet, scrim };
}

describe('PhoneDrawer', () => {
  it('is a named modal sheet with a grab handle, clear of the home indicator', () => {
    const { sheet, scrim } = drawer();
    expect(sheet.getAttribute('aria-modal')).toBe('true');
    expect(sheet.querySelector('[data-sheet-handle]')).not.toBeNull();
    expect(sheet.style.paddingBottom).toContain('safe-area-inset-bottom');
    expect(scrim.hasAttribute('data-phone-drawer-scrim')).toBe(true);
    // The popover layer by default, the modal layer when asked.
    expect(sheet.className).toContain('z-[var(--z-popover)]');
  });

  it('draws with the modals when asked, carrying its data attributes', () => {
    const { sheet } = drawer({ layer: 'modal', attrs: { 'data-floating-panel': '' } });
    expect(sheet.className).toContain('z-[var(--z-modal)]');
    expect(sheet.hasAttribute('data-floating-panel')).toBe(true);
  });

  it('is a floor the toast stack stands on while it shows, and not while hidden', () => {
    const { sheet, view } = drawer();
    expect(sheet.getAttribute('data-toast-floor')).toBe('popover');
    view.unmount();
    const hidden = drawer({ hidden: true });
    expect(hidden.sheet.hasAttribute('data-toast-floor')).toBe(false);
  });

  it('is named by a heading when given one', () => {
    render(
      <PhoneDrawer name="Vote" labelledBy="vote-title" onClose={() => undefined}>
        <h2 id="vote-title">Dot Vote</h2>
      </PhoneDrawer>,
    );
    expect(screen.getByRole('dialog', { name: 'Dot Vote' })).toBeTruthy();
  });

  it('closes on a tap on the scrim, which keeps the press to itself', () => {
    const under = vi.fn();
    const { onClose, scrim } = drawer();
    document.addEventListener('pointerdown', under);
    fireEvent.pointerDown(scrim);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(scrim);
    expect(onClose).toHaveBeenCalledTimes(1);
    document.removeEventListener('pointerdown', under);
  });

  it('keeps focus and the native menu from the scrim, and the native menu from the sheet', () => {
    const { sheet, scrim } = drawer();
    expect(fireEvent.mouseDown(scrim)).toBe(false);
    expect(fireEvent.contextMenu(scrim)).toBe(false);
    expect(fireEvent.contextMenu(sheet)).toBe(false);
  });

  it('keeps a press inside it from reaching a canvas gesture under it', () => {
    const canvas = vi.fn();
    render(
      <div onPointerDown={canvas}>
        <PhoneDrawer name="Tidy" onClose={() => undefined}>
          <button type="button">Tile</button>
        </PhoneDrawer>
      </div>,
    );
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Tile' }));
    expect(canvas).not.toHaveBeenCalled();
  });

  it('closes on Escape, ahead of the listeners after it', () => {
    const later = vi.fn();
    document.addEventListener('keydown', later);
    const { onClose } = drawer();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(later).not.toHaveBeenCalled();
    document.removeEventListener('keydown', later);
  });

  it('leaves Escape to a listening microphone inside it (voice-input.md "Stopping")', () => {
    const onClose = vi.fn();
    render(
      <PhoneDrawer name="AI" onClose={onClose}>
        <button type="button" data-voice-input="" aria-pressed="true">
          Stop Speaking
        </button>
      </PhoneDrawer>,
    );
    const mic = screen.getByRole('button', { name: 'Stop Speaking' });
    fireEvent.keyDown(mic, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    mic.setAttribute('aria-pressed', 'false');
    fireEvent.keyDown(mic, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('leaves Escape to a menu it opened that has focus, and to an earlier taker', () => {
    const menu = document.createElement('button');
    document.body.appendChild(menu);
    const { onClose } = drawer();
    menu.focus();
    fireEvent.keyDown(menu, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
    menu.remove();
    const handled = new KeyboardEvent('keydown', { key: 'Escape', cancelable: true });
    handled.preventDefault();
    window.dispatchEvent(handled);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('asks onEscape first, and passes Escape while passEscape says so', () => {
    let pass = true;
    const onEscape = vi.fn(() => true);
    const { onClose } = drawer({ onEscape, passEscape: () => pass });
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onEscape).not.toHaveBeenCalled();
    pass = false;
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onEscape).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keeps focus inside: in on opening, Tab wrapping at its ends', () => {
    const { sheet } = drawer();
    const first = screen.getByRole('button', { name: 'First' });
    const last = screen.getByRole('button', { name: 'Last' });
    expect(sheet.contains(document.activeElement)).toBe(true);
    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });

  it('hands focus back to what opened it on closing', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const { view } = drawer();
    expect(document.activeElement).not.toBe(opener);
    view.unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it('stays open but out of sight while hidden, and ignores Escape then', () => {
    const { sheet, scrim, onClose } = drawer({ hidden: true });
    expect(sheet.className.split(' ')).toContain('invisible');
    expect(scrim.className.split(' ')).toContain('invisible');
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });
});
