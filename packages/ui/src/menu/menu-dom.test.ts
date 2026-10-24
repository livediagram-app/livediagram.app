// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import {
  focusablesOf,
  isInMenuSurface,
  isTextEditFocused,
  itemLabel,
  menuItemsOf,
  openedFromKeyboard,
  ownsFocus,
  tabbableNeighbour,
} from './menu-dom';

const html = (markup: string) => {
  document.body.innerHTML = markup;
};
const byId = (id: string) => document.getElementById(id) as HTMLElement;

afterEach(() => {
  document.body.innerHTML = '';
});

describe('menuItemsOf', () => {
  it('lists the items this menu owns, in order, skipping nested menus and inert rows', () => {
    html(`
      <div id="m" role="menu" data-menu-surface="command">
        <button role="menuitem" id="a">Rename</button>
        <div role="group"><button role="menuitemcheckbox" id="b">Star</button></div>
        <div inert><button role="menuitem" id="hidden">Collapsed</button></div>
        <div id="sub" role="menu" data-menu-surface="command"><button role="menuitem" id="c">Inner</button></div>
        <a role="menuitemradio" id="d" href="#">Pick</a>
      </div>`);
    expect(menuItemsOf(byId('m')).map((el) => el.id)).toEqual(['a', 'b', 'd']);
    expect(menuItemsOf(byId('sub')).map((el) => el.id)).toEqual(['c']);
  });
});

describe('itemLabel', () => {
  it('reads the accessible name: aria-label first, then text', () => {
    html(
      `<button id="a" aria-label="Delete folder">x</button><button id="b"> Open <span>now</span></button>`,
    );
    expect(itemLabel(byId('a'))).toBe('Delete folder');
    expect(itemLabel(byId('b'))).toBe('Open now');
  });
});

describe('focusablesOf', () => {
  it('lists enabled controls outside inert sections', () => {
    html(`
      <div id="p">
        <button id="a">A</button>
        <button id="off" disabled>Off</button>
        <input id="b" />
        <div inert><button id="c">C</button></div>
        <span id="d" tabindex="0">D</span>
        <span tabindex="-1">E</span>
      </div>`);
    expect(focusablesOf(byId('p')).map((el) => el.id)).toEqual(['a', 'b', 'd']);
  });
});

describe('tabbableNeighbour', () => {
  it('finds the next and previous tabbable in document order, skipping an excluded subtree', () => {
    html(`
      <button id="before">Before</button>
      <button id="trigger">Trigger</button>
      <span tabindex="-1" id="skip">Skip</span>
      <div id="menu"><button id="in-menu">Item</button></div>
      <a id="after" href="#">After</a>`);
    const menu = byId('menu');
    expect(tabbableNeighbour(byId('trigger'), false, menu)?.id).toBe('after');
    expect(tabbableNeighbour(byId('trigger'), true, menu)?.id).toBe('before');
    expect(tabbableNeighbour(byId('after'), false, menu)).toBeNull();
  });
});

describe('ownsFocus', () => {
  it('owns focus in itself and in any surface whose parent chain leads to it', () => {
    html(`
      <div id="root" data-menu-surface="command"><button id="a">A</button></div>
      <div id="sub" data-menu-surface="command" data-menu-parent="root"><button id="b">B</button></div>
      <div id="subsub" data-menu-surface="command" data-menu-parent="sub"><button id="c">C</button></div>
      <div id="other" data-menu-surface="command"><button id="d">D</button></div>`);
    byId('c').focus();
    expect(ownsFocus(byId('root'))).toBe(true);
    expect(ownsFocus(byId('sub'))).toBe(true);
    expect(ownsFocus(byId('other'))).toBe(false);
    byId('a').focus();
    expect(ownsFocus(byId('root'))).toBe(true);
    expect(ownsFocus(byId('sub'))).toBe(false);
  });

  it('owns nothing when focus is on the body', () => {
    html(`<div id="root" data-menu-surface="command"></div>`);
    expect(ownsFocus(byId('root'))).toBe(false);
  });
});

describe('isInMenuSurface', () => {
  it('answers for targets inside either kind of menu', () => {
    html(`
      <div data-menu-surface="control"><button id="a">A</button></div>
      <button id="b">B</button>`);
    expect(isInMenuSurface(byId('a'))).toBe(true);
    expect(isInMenuSurface(byId('b'))).toBe(false);
    expect(isInMenuSurface(null)).toBe(false);
    expect(isInMenuSurface(window)).toBe(false);
  });
});

describe('isTextEditFocused', () => {
  it('is true for a text field or an editable region, false for a button', () => {
    html(
      `<input id="t" /><input id="c" type="checkbox" /><div id="e" contenteditable="true" tabindex="0"></div><button id="b">B</button>`,
    );
    byId('t').focus();
    expect(isTextEditFocused()).toBe(true);
    byId('c').focus();
    expect(isTextEditFocused()).toBe(false);
    byId('e').focus();
    expect(isTextEditFocused()).toBe(true);
    byId('b').focus();
    expect(isTextEditFocused()).toBe(false);
  });
});

describe('openedFromKeyboard', () => {
  it('follows the last interaction: a key press, then a pointer press', () => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(openedFromKeyboard()).toBe(true);
    document.dispatchEvent(new Event('pointerdown'));
    expect(openedFromKeyboard()).toBe(false);
  });
});
