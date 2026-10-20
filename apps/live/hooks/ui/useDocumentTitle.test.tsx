// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useDocumentTitle } from './useDocumentTitle';

// The browser tab names the document, and keeps naming it when the route's static <title> is committed again.
afterEach(() => {
  cleanup();
  document.title = '';
});

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('useDocumentTitle', () => {
  it('sets the title, and puts it back when the head rewrites it', async () => {
    renderHook(() => useDocumentTitle('Roadmap | livediagram'));
    expect(document.title).toBe('Roadmap | livediagram');
    document.title = 'livediagram';
    await flush();
    expect(document.title).toBe('Roadmap | livediagram');
  });

  it('leaves the title alone while there is none to give, and lets go once unmounted', async () => {
    document.title = 'livediagram';
    const { rerender, unmount } = renderHook(({ t }) => useDocumentTitle(t), {
      initialProps: { t: null as string | null },
    });
    expect(document.title).toBe('livediagram');
    rerender({ t: 'Plan | livediagram' });
    expect(document.title).toBe('Plan | livediagram');
    unmount();
    document.title = 'Elsewhere';
    await flush();
    expect(document.title).toBe('Elsewhere');
  });
});
