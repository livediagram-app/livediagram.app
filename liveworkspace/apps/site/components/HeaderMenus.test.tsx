// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// liveworkspace/docs/specs/010-site/site.md "The header": Product and Support menus; Pricing only with Pro on; the
// row for the page you are on is marked current.
const state = vi.hoisted(() => ({ pro: true, path: '/pricing' }));
vi.mock('@liveworkspace/subscription-ui/flag', () => ({ proOn: () => state.pro }));
vi.mock('next/navigation', () => ({ usePathname: () => state.path }));

const { HeaderMenus } = await import('./HeaderMenus');

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

  it('opens Support with Help, Status and Telemetry, current under a subpath', () => {
    state.path = '/help/livediagram';
    act(() => root.render(<HeaderMenus />));
    const rows = open('Support');
    expect(rows.map((row) => row.getAttribute('href'))).toEqual(['/help', '/status', '/telemetry']);
    expect(rows.map((row) => row.getAttribute('aria-current'))).toEqual(['page', null, null]);
  });

  it('closes when a row is chosen', () => {
    act(() => root.render(<HeaderMenus />));
    const first = open('Support')[0]!;
    first.addEventListener('click', (e) => e.preventDefault());
    act(() => (first as HTMLAnchorElement).click());
    expect(host.querySelector('[role=menu]')).toBeNull();
  });
});
