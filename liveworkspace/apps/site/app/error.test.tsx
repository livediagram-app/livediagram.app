// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LazyPageError } from '@/components/LazyPageError';
import { PAGE_ERROR_TITLE } from '@/components/page-error-title';
import { PLATFORM_APPEARANCE_KEY } from '@/lib/appearance/appearance-keys';
import PageErrorBoundary from './error';

// liveworkspace/docs/specs/010-site/site.md "Behaviour": a page that throws shows the site's card inside the layout.
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
  vi.restoreAllMocks();
});

describe('the error page', () => {
  it('has its own title, a main landmark with an h1, Try Again that renders again, and the way home', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // The card is its own chunk (components/LazyPageError.tsx): fetched first, it draws in the render's own commit.
    await LazyPageError.preload();
    const reset = vi.fn();
    act(() => root.render(<PageErrorBoundary error={new Error('boom')} reset={reset} />));
    expect(document.title).toBe(PAGE_ERROR_TITLE);
    const main = host.querySelector('main')!;
    expect(main.querySelectorAll('h1')).toHaveLength(1);
    expect(main.querySelector('h1')?.textContent).toBe('Something went wrong');
    const links = [...main.querySelectorAll('a')].map((a) => [
      a.getAttribute('href'),
      a.textContent,
    ]);
    expect(links).toContainEqual(['/', 'Go to the Home Page']);
    // And the status page, for a failure that is not this page's alone (Work Tracker 446).
    expect(links).toContainEqual(['/status', 'Check the Status Page']);
    const retry = [...main.querySelectorAll('button')].find((b) => b.textContent === 'Try Again')!;
    act(() => retry.click());
    expect(reset).toHaveBeenCalledTimes(1);
  });

  // Like the 404 page, it follows the chosen appearance, even where its <html> came back without the pre-paint
  // script's class (a development server renders the failed page's layout again on the client).
  it.each([
    ['dark', true],
    ['light', false],
  ])('paints the chosen appearance (%s) on <html>', async (choice, dark) => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    await LazyPageError.preload();
    localStorage.setItem(PLATFORM_APPEARANCE_KEY, choice);
    document.documentElement.classList.remove('dark');
    act(() => root.render(<PageErrorBoundary error={new Error('boom')} reset={() => {}} />));
    expect(document.documentElement.classList.contains('dark')).toBe(dark);
    localStorage.removeItem(PLATFORM_APPEARANCE_KEY);
    document.documentElement.classList.remove('dark');
  });

  it('follows the device with no choice of its own', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.stubGlobal('matchMedia', () => ({ matches: true }));
    await LazyPageError.preload();
    document.documentElement.classList.remove('dark');
    act(() => root.render(<PageErrorBoundary error={new Error('boom')} reset={() => {}} />));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    vi.unstubAllGlobals();
    document.documentElement.classList.remove('dark');
  });

  it('leaves the page as it is when storage is denied', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    await LazyPageError.preload();
    document.documentElement.classList.add('dark');
    act(() => root.render(<PageErrorBoundary error={new Error('boom')} reset={() => {}} />));
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    document.documentElement.classList.remove('dark');
  });
});
