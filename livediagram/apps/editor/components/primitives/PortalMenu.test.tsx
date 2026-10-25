// @vitest-environment jsdom

// A portal menu hangs off its anchor and is nudged back inside the viewport when it would overflow,
// settling on the first measurement.

import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VIEWPORT_EDGE_MARGIN } from '@liveworkspace/workbench/lib/clamp-to-viewport';
import {
  MenuAccordionSection,
  MenuActionRow,
  MenuGroupSeparator,
  MenuHeader,
  PortalMenu,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { MenuTile, MenuToolButton } from './MenuTiles';
import { BESIDE_GAP } from '@liveworkspace/workbench/components/primitives/beside-placement';

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
  it('closes on a press outside it, but not in a flyout or a popover it opened', () => {
    const onClose = vi.fn();
    const popover = document.createElement('div');
    popover.setAttribute('data-anchored-popover', '');
    const swatch = document.createElement('button');
    popover.appendChild(swatch);
    document.body.appendChild(popover);
    render(
      <PortalMenu anchor={document.createElement('button')} placement="below" onClose={onClose}>
        <span>Item</span>
      </PortalMenu>,
    );
    fireEvent.pointerDown(swatch);
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.pointerDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
    popover.remove();
  });

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

// docs/specs/013-workspace/explorer-home.md "Jump Back In": a card's menu opens beside the card, out of its way.
describe('PortalMenu beside a card', () => {
  const open = (card: DOMRect) => {
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(MENU_W);
    vi.mocked(HTMLElement.prototype.getBoundingClientRect).mockImplementation(function (
      this: HTMLElement,
    ) {
      if (this.hasAttribute('data-menu-surface')) {
        return rect(parseFloat(this.style.left), parseFloat(this.style.top), MENU_W, MENU_H);
      }
      if (this.hasAttribute('data-card')) return card;
      // The ⋯ at the card's top right.
      return rect(card.right - 40, card.top + 8, 32, 32);
    });
    const beside = document.createElement('div');
    beside.setAttribute('data-card', '');
    render(
      <PortalMenu
        anchor={document.createElement('button')}
        placement="below"
        beside={beside}
        onClose={() => {}}
      >
        <span>Item</span>
      </PortalMenu>,
    );
    return screen.getByRole('menu');
  };

  it("opens to the card's right, its top level with the card's", () => {
    const menu = open(rect(100, 120, 220, 180));
    expect(menu.style.left).toBe(`${320 + BESIDE_GAP}px`);
    expect(menu.style.top).toBe('120px');
    expect(menu.style.transform).toBe('none');
  });

  it('opens to its left when the right has no room', () => {
    const menu = open(rect(700, 120, 220, 180));
    expect(menu.style.left).toBe(`${700 - BESIDE_GAP - MENU_W}px`);
    expect(menu.style.transform).toBe('none');
  });

  it('hangs below the ⋯ when neither side has room', () => {
    const menu = open(rect(20, 120, window.innerWidth - 40, 180));
    // Hung from the ⋯'s bottom right, as every other menu.
    expect(menu.style.top).toBe(`${120 + 8 + 32}px`);
    expect(menu.style.transform).toBe('translate(-100%, 4px)');
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
