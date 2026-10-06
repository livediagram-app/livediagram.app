// @vitest-environment jsdom

// A portal menu hangs off its anchor and is nudged back inside the viewport when it would overflow,
// settling on the first measurement.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VIEWPORT_EDGE_MARGIN } from '@/lib/clamp-to-viewport';
import {
  MenuAccordionSection,
  MenuActionRow,
  MenuGroupSeparator,
  MenuHeader,
  PortalMenu,
} from './PortalMenu';
import { MenuTile, MenuToolButton } from './MenuTiles';

const MENU_W = 224;
const MENU_H = 300;

const rect = (left: number, top: number, width: number, height: number) =>
  ({
    left,
    top,
    right: left + width,
    bottom: top + height,
    width,
    height,
    x: left,
    y: top,
  }) as DOMRect;

beforeEach(() => {
  // jsdom has no layout: the menu measures from its own left / top, the anchor from a fixed box.
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    if (this.hasAttribute('data-menu-surface')) {
      return rect(parseFloat(this.style.left), parseFloat(this.style.top), MENU_W, MENU_H);
    }
    return rect(400, 660, 100, 40);
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('PortalMenu', () => {
  it('lifts a menu that would overflow the bottom edge back inside', () => {
    const anchor = document.createElement('button');
    render(
      <PortalMenu anchor={anchor} placement="below" onClose={() => {}}>
        <span>Item</span>
      </PortalMenu>,
    );
    const menu = screen.getByRole('menu');
    expect(parseFloat(menu.style.top) + MENU_H).toBe(window.innerHeight - VIEWPORT_EDGE_MARGIN);
    expect(menu.style.left).toBe('500px');
  });

  it('leaves a menu that fits where it hangs', () => {
    vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.hasAttribute('data-menu-surface')) {
        return rect(parseFloat(this.style.left), parseFloat(this.style.top), MENU_W, MENU_H);
      }
      return rect(400, 100, 100, 40);
    });
    render(
      <PortalMenu anchor={document.createElement('button')} placement="below" onClose={() => {}}>
        <span>Item</span>
      </PortalMenu>,
    );
    expect(screen.getByRole('menu').style.top).toBe('140px');
  });

  it('hangs from the anchor left edge when placed at the start', () => {
    vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.hasAttribute('data-menu-surface')) {
        return rect(parseFloat(this.style.left), parseFloat(this.style.top), MENU_W, MENU_H);
      }
      return rect(40, 100, 600, 30);
    });
    render(
      <PortalMenu
        anchor={document.createElement('button')}
        placement="below-start"
        onClose={() => {}}
      >
        <span>Item</span>
      </PortalMenu>,
    );
    const menu = screen.getByRole('menu');
    expect(menu.style.left).toBe('40px');
    expect(menu.style.top).toBe('130px');
    expect(menu.style.transform).toBe('translate(0, 4px)');
  });
});

// docs/specs/004-interface-design/menus.md: a row takes the role of the menu it sits in.
describe('PortalMenu rows by kind', () => {
  const rows = (onClick = vi.fn()) => (
    <>
      <MenuHeader title="Retros" />
      <MenuToolButton
        icon={null}
        label="Lock"
        description="Lock it."
        onClick={onClick}
        active={false}
      />
      <MenuActionRow plain icon={null} label="Rename" onClick={onClick} />
      <MenuActionRow icon={null} label="Paste" onClick={onClick} disabled />
      <MenuGroupSeparator />
      <MenuTile label="Hide Others" onClick={onClick} disabled />
      <MenuAccordionSection title="Merge" icon={null} open={false} onToggle={() => {}}>
        <MenuTile label="With Layer Above" onClick={onClick} />
      </MenuAccordionSection>
    </>
  );

  it('makes them menu items in a command menu, named by the header', () => {
    const onClick = vi.fn();
    render(
      <PortalMenu anchor={document.createElement('button')} onClose={() => {}}>
        {rows(onClick)}
      </PortalMenu>,
    );
    const menu = screen.getByRole('menu', { name: 'Retros' });
    expect(menu.getAttribute('data-menu-surface')).toBe('command');
    expect(
      screen.getByRole('menuitemcheckbox', { name: 'Lock' }).getAttribute('aria-checked'),
    ).toBe('false');
    expect(screen.getByRole('menuitem', { name: 'Rename' }).tabIndex).toBe(-1);
    const paste = screen.getByRole('menuitem', { name: 'Paste' });
    expect(paste.getAttribute('aria-disabled')).toBe('true');
    const hide = screen.getByRole('menuitem', { name: 'Hide Others' });
    expect(hide.hasAttribute('disabled')).toBe(false);
    fireEvent.click(hide);
    expect(onClick).not.toHaveBeenCalled();
    expect(screen.getByRole('separator')).toBeTruthy();
    const merge = screen.getByRole('menuitem', { name: 'Merge' });
    expect(merge.getAttribute('aria-expanded')).toBe('false');
    // Collapsed: the group's rows are inert, so neither Tab nor the arrows reach them.
    const group = screen.getByRole('group', { hidden: true });
    expect(group.getAttribute('aria-labelledby')).toBe(merge.id);
    expect(group.hasAttribute('inert')).toBe(true);
    // First own item takes focus on open.
    expect(document.activeElement).toBe(screen.getByRole('menuitemcheckbox', { name: 'Lock' }));
  });

  it('leaves them plain controls in a control menu', () => {
    render(
      <PortalMenu
        anchor={document.createElement('button')}
        surface="control"
        label="Live image"
        onClose={() => {}}
      >
        {rows()}
      </PortalMenu>,
    );
    expect(screen.getByRole('dialog', { name: 'Live image' })).toBeTruthy();
    expect(screen.queryByRole('menuitem')).toBeNull();
    expect(screen.getByRole('button', { name: 'Lock' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Merge' }).getAttribute('aria-expanded')).toBe(
      'false',
    );
  });
});
