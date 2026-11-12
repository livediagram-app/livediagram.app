// @vitest-environment jsdom
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, describe, expect, it, vi } from 'vitest';

// The card's own chunk failing to load (offline): its import rejects.
vi.mock('./PageError', () => {
  throw new Error('chunk failed');
});
const { LazyPageError } = await import('./LazyPageError');
const { PAGE_ERROR_TITLE } = await import('./page-error-title');

// liveworkspace/docs/specs/010-site/site.md "Behaviour": when the card's code can't load, the same title, heading,
// line and two actions show plainly.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => vi.restoreAllMocks());

describe('LazyPageError without its chunk', () => {
  it('shows the plain card: title, h1, the line, Try Again and the way home', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    document.title = 'Status · liveworkspace';
    const host = document.createElement('div');
    document.body.append(host);
    const root = createRoot(host);
    const retry = vi.fn();
    await act(async () => root.render(<LazyPageError onRetry={retry} />));
    await act(() => LazyPageError.preload());
    const main = host.querySelector('main')!;
    expect(main.querySelector('h1')?.textContent).toBe('Something went wrong');
    expect(main.textContent).toContain('Nothing you made was lost');
    expect(document.title).toBe(PAGE_ERROR_TITLE);
    expect(main.querySelector('a[href="/"]')?.textContent).toBe('Go to the Home Page');
    act(() => main.querySelector('button')!.click());
    expect(retry).toHaveBeenCalledTimes(1);
    act(() => root.unmount());
    expect(document.title).toBe('Status · liveworkspace');
    host.remove();
  });
});
