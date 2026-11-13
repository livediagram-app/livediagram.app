// @vitest-environment jsdom
// A portalled command menu's landmark (docs/specs/004-interface-design/menus.md "Semantics"): named as given, else
// as its trigger is, else "Menu".
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MenuLandmark, menuLandmarkName } from './MenuLandmark';

const button = (attrs: Record<string, string>, text = '') => {
  const el = document.createElement('button');
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  el.textContent = text;
  return el;
};

describe('menuLandmarkName', () => {
  it('takes the name given over the trigger’s', () => {
    expect(menuLandmarkName('Row menu', button({ 'aria-label': 'More' }))).toBe('Row menu');
  });

  it('falls back to the trigger’s accessible name, then to Menu', () => {
    expect(menuLandmarkName(undefined, button({ 'aria-label': 'Menu for Specs' }))).toBe(
      'Menu for Specs',
    );
    expect(menuLandmarkName('', button({}, '  Mode  '))).toBe('Mode');
    expect(menuLandmarkName(undefined, button({}))).toBe('Menu');
    expect(menuLandmarkName(undefined, null)).toBe('Menu');
    expect(menuLandmarkName()).toBe('Menu');
  });
});

describe('MenuLandmark', () => {
  it('is a named region holding the menu', () => {
    render(
      <MenuLandmark name="Column menu">
        <div role="menu" aria-label="Column menu" />
      </MenuLandmark>,
    );
    const region = screen.getByRole('region', { name: 'Column menu' });
    expect(region.contains(screen.getByRole('menu'))).toBe(true);
  });
});
