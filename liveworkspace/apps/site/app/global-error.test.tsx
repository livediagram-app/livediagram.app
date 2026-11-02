// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./globals.css', () => ({}));
const { default: GlobalError } = await import('./global-error');
const { PAGE_ERROR_TITLE } = await import('@/components/PageError');

// liveworkspace/docs/specs/010-site/site.md "Behaviour": the root error boundary is the site's own page, never
// Next's bare one (no title, no lang, no main landmark).
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => vi.restoreAllMocks());

describe('GlobalError', () => {
  it('stands in for the layout with a title, lang, a main landmark, an h1, Try Again and the way home', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reload = vi.fn();
    vi.spyOn(window, 'location', 'get').mockReturnValue({ ...window.location, reload });
    const root = createRoot(document);
    act(() => root.render(<GlobalError error={new Error('boom')} reset={() => {}} />));
    expect(document.documentElement.getAttribute('lang')).toBe('en-GB');
    expect(document.title).toBe(PAGE_ERROR_TITLE);
    const main = document.querySelector('main')!;
    expect(main.querySelector('h1')?.textContent).toBe('Something went wrong');
    expect(main.querySelector('a[href="/"]')?.textContent).toBe('Go to the Home Page');
    const retry = [...main.querySelectorAll('button')].find((b) => b.textContent === 'Try Again')!;
    act(() => retry.click());
    expect(reload).toHaveBeenCalledTimes(1);
    expect(console.error).toHaveBeenCalled();
    act(() => root.unmount());
  });
});
