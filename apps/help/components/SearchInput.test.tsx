// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { SearchInput } from './SearchInput';

// docs/specs/018-help/help-pages.md "Search": `/` focuses the page's search box (the large one where a page has
// it), never while the reader is typing elsewhere, and Escape leaves the box.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// jsdom lays nothing out, so every element reads as hidden; stand in for a laid-out page.
const offsetParent = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'offsetParent');
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get: () => document.body,
  });
});
afterAll(() => {
  if (offsetParent) Object.defineProperty(HTMLElement.prototype, 'offsetParent', offsetParent);
});

let roots: Root[] = [];
afterEach(() => {
  act(() => roots.forEach((r) => r.unmount()));
  roots = [];
  document.body.innerHTML = '';
});

function mount(large: boolean) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  roots.push(root);
  act(() => root.render(<SearchInput large={large} />));
  return host.querySelector('input')!;
}

const press = (key: string, target: EventTarget = document.body) =>
  act(() => {
    target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
  });

describe('search keys', () => {
  it('focuses the header box on a page without a large one', () => {
    const header = mount(false);
    press('/');
    expect(document.activeElement).toBe(header);
  });

  it('gives the key to the large box when the page has one', () => {
    mount(false);
    const large = mount(true);
    press('/');
    expect(document.activeElement).toBe(large);
  });

  it('leaves a reader typing in another field alone', () => {
    const header = mount(false);
    const other = document.createElement('textarea');
    document.body.appendChild(other);
    other.focus();
    press('/', other);
    expect(document.activeElement).toBe(other);
    expect(document.activeElement).not.toBe(header);
  });

  it('ignores the key with a modifier held', () => {
    const header = mount(false);
    act(() => {
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: '/', metaKey: true, bubbles: true }),
      );
    });
    expect(document.activeElement).not.toBe(header);
  });

  it('leaves the box on Escape', () => {
    const header = mount(false);
    press('/');
    press('Escape', header);
    expect(document.activeElement).not.toBe(header);
  });
});

// docs/specs/018-help/help-pages.md "Search": what the dropdown holds is announced, since nothing else tells a screen
// reader results came.
const type = (input: HTMLInputElement, value: string) => {
  // React reads a change from the native value setter and an input event.
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
};
const settle = () => act(async () => new Promise((resolve) => setTimeout(resolve, 50)));

describe('SearchInput results', () => {
  it('announces how many articles it found, or that it found none', async () => {
    const input = mount(false);
    const status = () => document.querySelector('[aria-live="polite"]')?.textContent;
    act(() => {
      input.focus();
      type(input, 'export');
    });
    await settle();
    await settle();
    expect(status()).toMatch(/^\d+ articles? found$/);
    expect(document.querySelector('[role="region"][aria-label="Search results"]')).not.toBeNull();
    act(() => type(input, 'zzqqxx'));
    expect(status()).toBe('No articles found for zzqqxx');
  });
});
