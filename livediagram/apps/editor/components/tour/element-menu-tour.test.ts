// @vitest-environment jsdom
// Menu steps open the element's own menu to the part they explain (docs/specs/007-editor/element-tours.md "Menu
// steps"): each row of the path in turn, then mark what the last one opened.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearMenuPath, CONTEXT_MENU, MENU_TARGET, openMenuPath } from './element-menu-tour';

// jsdom lays nothing out, so "on screen" is just "in the document" here.
vi.mock('@liveworkspace/workbench/components/tour/tour-dom', async (actual) => ({
  ...(await actual<typeof import('@liveworkspace/workbench/components/tour/tour-dom')>()),
  waitForSelector: async (selector: string) => document.querySelector<HTMLElement>(selector),
}));

const onScreen = { length: 1 } as DOMRectList;
beforeEach(() => {
  vi.spyOn(Element.prototype, 'getClientRects').mockReturnValue(onScreen);
});
afterEach(() => {
  vi.restoreAllMocks();
  document.body.innerHTML = '';
});

// A menu row as ContextMenu draws it: an accordion section's header, or a flyout row that opens a panel beside it.
function row(parent: Element, title: string, flyout = false): HTMLButtonElement {
  const section = document.createElement('section');
  const button = document.createElement('button');
  button.textContent = title;
  button.setAttribute('aria-expanded', 'false');
  if (flyout) button.setAttribute('aria-haspopup', 'menu');
  button.addEventListener('click', () => {
    button.setAttribute('aria-expanded', 'true');
    if (!flyout) return;
    const panel = document.createElement('div');
    panel.setAttribute('data-menu-flyout', '');
    document.body.append(panel);
    row(panel, 'Rows');
  });
  section.append(button);
  parent.append(section);
  return button;
}

function menu(): HTMLElement {
  const el = document.createElement('div');
  el.setAttribute('data-tour-id', 'context-menu');
  document.body.append(el);
  return el;
}

describe('openMenuPath', () => {
  it('opens an accordion row and marks its section', async () => {
    const m = menu();
    const style = row(m, 'Style');
    await openMenuPath(['Style']);
    expect(style.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelector(MENU_TARGET)).toBe(style.parentElement);
  });

  it('follows a path through a flyout, then marks the flyout the last row opened', async () => {
    const m = menu();
    row(m, 'Tools', true);
    await openMenuPath(['Tools']);
    expect(document.querySelector(MENU_TARGET)).toBe(document.querySelector('[data-menu-flyout]'));
    await openMenuPath(['Tools', 'Rows']);
    const rows = [...document.querySelectorAll('[data-menu-flyout] button')].find(
      (b) => b.textContent === 'Rows',
    )!;
    expect(rows.getAttribute('aria-expanded')).toBe('true');
    expect(document.querySelectorAll(MENU_TARGET)).toHaveLength(1);
  });

  it('leaves a row already open as it is', async () => {
    const m = menu();
    const style = row(m, 'Style');
    style.setAttribute('aria-expanded', 'true');
    const click = vi.spyOn(style, 'click');
    await openMenuPath(['Style']);
    expect(click).not.toHaveBeenCalled();
  });

  it('marks nothing without the menu', async () => {
    await openMenuPath(['Style']);
    expect(document.querySelector(CONTEXT_MENU)).toBeNull();
    expect(document.querySelector(MENU_TARGET)).toBeNull();
  });

  it('lets go of the mark', async () => {
    row(menu(), 'Style');
    await openMenuPath(['Style']);
    clearMenuPath();
    expect(document.querySelector(MENU_TARGET)).toBeNull();
  });
});
