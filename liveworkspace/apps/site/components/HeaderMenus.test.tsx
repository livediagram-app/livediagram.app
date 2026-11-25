// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

// liveworkspace/docs/specs/010-site/site.md "The header": Product and Support menus; Pricing only with Pro on; the
// row for the page you are on is marked current.
const state = vi.hoisted(() => ({ pro: true, path: '/pricing' }));
vi.mock('@liveworkspace/subscription-ui/flag', () => ({ proOn: () => state.pro }));
vi.mock('next/navigation', () => ({ usePathname: () => state.path }));

const { HeaderMenus, preloadHeaderMenus } = await import('./HeaderMenus');
const { headerMenuPages } = await import('./header-menu-pages');

// The open menu is a chunk of its own, fetched as a pointer or focus reaches a button: in by the press, as here.
beforeAll(async () => {
  await preloadHeaderMenus();
}, 60_000);

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

let host: HTMLDivElement;
let root: Root;
beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  state.pro = true;
  state.path = '/pricing';
});

const trigger = (name: string) =>
  host.querySelector<HTMLButtonElement>(`[data-header-menu="${name}"] button`)!;
const open = (name: string) => {
  act(() => trigger(name).click());
  return [...host.querySelectorAll(`[data-header-menu="${name}"] [role=menuitem]`)];
};

describe('HeaderMenus', () => {
  it('draws two closed menu buttons', () => {
    act(() => root.render(<HeaderMenus />));
    for (const name of ['Product', 'Support']) {
      expect(trigger(name).getAttribute('aria-haspopup')).toBe('menu');
      expect(trigger(name).getAttribute('aria-expanded')).toBe('false');
    }
    expect(host.querySelector('[role=menu]')).toBeNull();
  });

  it('opens Product with Pricing among its pages, marking the current one', () => {
    act(() => root.render(<HeaderMenus />));
    const rows = open('Product');
    expect(trigger('Product').getAttribute('aria-expanded')).toBe('true');
    expect(rows.map((row) => row.getAttribute('href'))).toEqual([
      '/#apps',
      '/pricing',
      '/compare',
      '/community',
    ]);
    expect(rows.map((row) => row.getAttribute('aria-current'))).toEqual([null, 'page', null, null]);
    expect(rows.map((row) => row.textContent).join()).toContain('Our AppsEvery app, free to use');
  });

  it('leaves Pricing out with Pro off', () => {
    state.pro = false;
    act(() => root.render(<HeaderMenus />));
    expect(open('Product').map((row) => row.getAttribute('href'))).toEqual([
      '/#apps',
      '/compare',
      '/community',
    ]);
  });

  it('opens Support with Help, Build with AI, Status and Telemetry, current under a subpath', () => {
    state.path = '/help/livediagram';
    act(() => root.render(<HeaderMenus />));
    const rows = open('Support');
    expect(rows.map((row) => row.getAttribute('href'))).toEqual([
      '/help',
      '/ai',
      '/status',
      '/telemetry',
    ]);
    expect(rows.map((row) => row.getAttribute('aria-current'))).toEqual(['page', null, null, null]);
  });

  it('lists Build with AI in Support, current on /ai', () => {
    state.path = '/ai';
    act(() => root.render(<HeaderMenus />));
    expect(trigger('Support').className).toContain('text-slate-900 dark:text-white');
    const row = open('Support').find((r) => r.getAttribute('href') === '/ai')!;
    expect(row.textContent).toContain('Build with AIConnect your AI to every app');
    expect(row.getAttribute('aria-current')).toBe('page');
  });

  it.each([true, false])('each button knows its menu’s pages without the rows (Pro %s)', (pro) => {
    // The buttons mark themselves on one of their pages from header-menu-pages.ts; the rows are the lazy surface's.
    state.pro = pro;
    act(() => root.render(<HeaderMenus />));
    for (const name of ['Product', 'Support'] as const) {
      const hrefs = open(name).map((row) => row.getAttribute('href')!);
      expect(hrefs.filter((href) => !href.includes('#'))).toEqual(headerMenuPages(name));
      act(() => trigger(name).click());
    }
  });

  it('marks the button of the menu the page is in', () => {
    act(() => root.render(<HeaderMenus />));
    expect(trigger('Product').className).toContain('text-slate-900 dark:text-white');
    expect(trigger('Support').className).not.toContain('text-slate-900 dark:text-white');
  });

  it('closes when a row is chosen', () => {
    act(() => root.render(<HeaderMenus />));
    const first = open('Support')[0]!;
    first.addEventListener('click', (e) => e.preventDefault());
    act(() => (first as HTMLAnchorElement).click());
    expect(host.querySelector('[role=menu]')).toBeNull();
  });
});
