// @vitest-environment jsdom
// docs/specs/007-editor/panel-docking.md "Scope": opened from the keyboard, a dock popover takes focus; Escape closes it
// while focus is in it or on its button, focus going back to the button; Escape elsewhere leaves it open. Find a
// Card's field could not be left by Escape, and Tab from Layers' button never reached Layers.
import { renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDockPopoverKeys } from './useDockPopoverKeys';

afterEach(() => {
  document.body.innerHTML = '';
});

function setup(opts: { keyboard?: boolean } = {}) {
  const strip = document.createElement('div');
  strip.setAttribute('data-dock-button', '');
  const button = document.createElement('button');
  button.setAttribute('aria-expanded', 'true');
  strip.append(button);
  const panel = document.createElement('div');
  const field = document.createElement('input');
  panel.append(field);
  const canvas = document.createElement('main');
  canvas.tabIndex = 0;
  document.body.append(strip, panel, canvas);
  const onClose = vi.fn();
  // The last interaction, as input-modality reads it.
  document.dispatchEvent(new Event(opts.keyboard ? 'keydown' : 'pointerdown'));
  button.focus();
  renderHook(() => useDockPopoverKeys({ current: panel }, true, onClose));
  return { button, field, canvas, onClose };
}

const escape = () => {
  const e = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
  (document.activeElement ?? document.body).dispatchEvent(e);
  return e;
};

describe('useDockPopoverKeys', () => {
  it('closes from inside and hands focus back to the button', () => {
    const { button, field, onClose } = setup();
    field.focus();
    expect(escape().defaultPrevented).toBe(true);
    expect(onClose).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(button);
  });

  it('closes from its button', () => {
    const { button, onClose } = setup();
    button.focus();
    escape();
    expect(onClose).toHaveBeenCalledOnce();
    expect(document.activeElement).toBe(button);
  });

  it('leaves Escape on the canvas to the canvas', () => {
    const { canvas, onClose } = setup();
    canvas.focus();
    expect(escape().defaultPrevented).toBe(false);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('takes focus to its first control when the keyboard opened it, not a pointer', () => {
    const { field } = setup({ keyboard: true });
    expect(document.activeElement).toBe(field);
    document.body.innerHTML = '';
    const pointer = setup();
    expect(document.activeElement).toBe(pointer.button);
  });

  it('leaves one a panel inside it already handled', () => {
    const { field, onClose } = setup();
    field.focus();
    field.addEventListener('keydown', (e) => e.preventDefault(), { capture: true, once: true });
    window.addEventListener('keydown', (e) => e.preventDefault(), { capture: true, once: true });
    escape();
    expect(onClose).not.toHaveBeenCalled();
  });
});
