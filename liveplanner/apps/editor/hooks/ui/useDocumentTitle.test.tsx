// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { useDocumentTitle } from './useDocumentTitle';

afterEach(() => {
  cleanup();
  document.title = '';
});

describe('useDocumentTitle', () => {
  it('sets the title, and puts it back when the route metadata rewrites it after hydration', async () => {
    document.title = 'Form | liveplanner';
    renderHook(() => useDocumentTitle('Job Application | liveplanner'));
    expect(document.title).toBe('Job Application | liveplanner');
    // Next.js commits the page's static metadata <title> a moment later, over the text the effect wrote.
    document.querySelector('title')!.textContent = 'Form | liveplanner';
    await waitFor(() => expect(document.title).toBe('Job Application | liveplanner'));
  });

  it('leaves the title alone while there is none to show, and stops watching once unmounted', async () => {
    document.title = 'Form | liveplanner';
    const { rerender, unmount } = renderHook(({ t }: { t: string | null }) => useDocumentTitle(t), {
      initialProps: { t: null as string | null },
    });
    expect(document.title).toBe('Form | liveplanner');
    rerender({ t: 'Feedback | liveplanner' });
    expect(document.title).toBe('Feedback | liveplanner');
    unmount();
    document.title = 'Elsewhere';
    await new Promise((r) => setTimeout(r, 20));
    expect(document.title).toBe('Elsewhere');
  });
});
