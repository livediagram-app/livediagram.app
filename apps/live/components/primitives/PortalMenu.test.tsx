// @vitest-environment jsdom

// A portal menu hangs off its anchor and is nudged back inside the viewport when it would overflow,
// settling on the first measurement.

import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { VIEWPORT_EDGE_MARGIN } from '@/lib/clamp-to-viewport';
import { PortalMenu } from './PortalMenu';

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
    if (this.getAttribute('role') === 'menu') {
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
      if (this.getAttribute('role') === 'menu') {
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
});
