// @vitest-environment jsdom
// Watch It Built's hands on the real chrome (docs/specs/007-editor/blueprints/watch-it-built.md "Driving the chrome"):
// finding controls by their words, opening only the element menu's rows, and closing what it opened innermost first.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { findNode, openMenuPath, syncOpen, typeInto, OPENABLES } from './replay-dom';

const sized = <T extends HTMLElement>(el: T): T => {
  el.getBoundingClientRect = () => ({ left: 0, top: 0, width: 10, height: 10 }) as DOMRect;
  return el;
};
const button = (text: string, attrs: Record<string, string> = {}) => {
  const b = sized(document.createElement('button'));
  b.textContent = text;
  for (const [k, v] of Object.entries(attrs)) b.setAttribute(k, v);
  return b;
};
afterEach(() => {
  document.body.innerHTML = '';
});

describe('findNode', () => {
  it('prefers exact words, then an ending, a start, then words it holds; reads aria-label too', () => {
    const box = document.createElement('div');
    box.className = 'box';
    box.append(
      button('Plan the workSpectrumRainbow'),
      button('ASoft'),
      button('Soft shadow'),
      button('', { 'aria-label': 'Thick' }),
      button('Extra', { 'aria-label': 'Extra Thick' }),
    );
    document.body.append(box);
    expect(findNode('.box button', 'spectrum')?.textContent).toBe('Plan the workSpectrumRainbow');
    expect(findNode('.box button', 'Soft')?.textContent).toBe('ASoft');
    expect(findNode('.box button', 'Thick')?.getAttribute('aria-label')).toBe('Thick');
    expect(findNode('.box button', 'nothing')).toBeNull();
  });

  it('skips what is not on screen', () => {
    const hidden = document.createElement('button');
    hidden.textContent = 'Hidden';
    hidden.className = 'x';
    document.body.append(hidden, button('Shown', { class: 'x' }));
    expect(findNode('.x')?.textContent).toBe('Shown');
  });
});

describe('openMenuPath', () => {
  it('presses only rows that open something, and only while they are shut', () => {
    const menu = document.createElement('div');
    menu.setAttribute('data-menu-flyout', '');
    const swatch = button('Border', { 'aria-expanded': 'false' });
    const row = button('Border', { 'aria-expanded': 'false', 'data-menu-section': 'Border' });
    const open = button('Style', { 'aria-expanded': 'true', 'data-menu-section': 'Style' });
    const pressed: string[] = [];
    swatch.onclick = () => pressed.push('swatch');
    row.onclick = () => pressed.push('row');
    open.onclick = () => pressed.push('style');
    menu.append(swatch, row, open);
    document.body.append(menu);
    openMenuPath(['Style', 'Border']);
    expect(pressed).toEqual(['row']);
  });
});

describe('syncOpen', () => {
  it('opens what is wanted and closes what it opened, the last opened first', () => {
    const state: Record<string, boolean> = { a: false, b: false };
    const order: string[] = [];
    const fake = (id: string) => ({
      isOpen: () => state[id]!,
      toggle: () => {
        order.push(id);
        state[id] = !state[id];
      },
    });
    const restore = { ...OPENABLES };
    Object.assign(OPENABLES, { a: fake('a'), b: fake('b') });
    try {
      const opened = new Set<string>();
      syncOpen(['a', 'b', 'missing'], opened);
      expect(state).toEqual({ a: true, b: true });
      syncOpen(['a', 'b'], opened);
      expect(order).toEqual(['a', 'b']);
      syncOpen([], opened);
      expect(order).toEqual(['a', 'b', 'b', 'a']);
      expect(opened.size).toBe(0);
    } finally {
      delete (OPENABLES as Record<string, unknown>).a;
      delete (OPENABLES as Record<string, unknown>).b;
      Object.assign(OPENABLES, restore);
    }
  });
});

describe('typeInto', () => {
  it('sets the value through the input setter and tells React with an input event', () => {
    const input = sized(document.createElement('input'));
    input.className = 'q';
    const heard = vi.fn();
    input.addEventListener('input', heard);
    document.body.append(input);
    typeInto('.q', 'data');
    typeInto('.q', 'data');
    expect(input.value).toBe('data');
    expect(heard).toHaveBeenCalledTimes(1);
  });
});
