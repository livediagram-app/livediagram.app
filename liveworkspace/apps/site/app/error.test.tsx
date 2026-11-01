// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PAGE_ERROR_TITLE } from '@/components/PageError';
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
  it('has its own title, a main landmark with an h1, Try Again that renders again, and the way home', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reset = vi.fn();
    act(() => root.render(<PageErrorBoundary error={new Error('boom')} reset={reset} />));
    expect(document.title).toBe(PAGE_ERROR_TITLE);
    const main = host.querySelector('main')!;
    expect(main.querySelectorAll('h1')).toHaveLength(1);
    expect(main.querySelector('h1')?.textContent).toBe('Something went wrong');
    expect(main.querySelector('a[href="/"]')?.textContent).toBe('Go to the Home Page');
    const retry = [...main.querySelectorAll('button')].find((b) => b.textContent === 'Try Again')!;
    act(() => retry.click());
    expect(reset).toHaveBeenCalledTimes(1);
  });
});
