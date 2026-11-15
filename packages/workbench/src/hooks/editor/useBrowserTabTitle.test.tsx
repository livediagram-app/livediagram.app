// @vitest-environment jsdom
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { useBrowserTabTitle } from './useBrowserTabTitle';

afterEach(() => {
  cleanup();
  document.head.innerHTML = '';
  document.title = '';
});

describe('useBrowserTabTitle', () => {
  it('sets the title, and puts it back when the route metadata rewrites it after hydration', async () => {
    document.title = 'Form | liveplanner';
    renderHook(() => useBrowserTabTitle('Job Application | liveplanner'));
    expect(document.title).toBe('Job Application | liveplanner');
    document.querySelector('title')!.textContent = 'Form | liveplanner';
    await waitFor(() => expect(document.title).toBe('Job Application | liveplanner'));
  });

  // The Thomas HQ open: the not-found route's metadata title landed after the warm paint named the Space.
  it('puts the title back when the framework replaces the title element', async () => {
    renderHook(() => useBrowserTabTitle('Thomas HQ | livehuddle'));
    const replaced = document.createElement('title');
    replaced.textContent = 'livehuddle';
    document.head.replaceChildren(replaced);
    await waitFor(() => expect(document.title).toBe('Thomas HQ | livehuddle'));
  });

  it('leaves the title alone while there is none to show, follows a rename, and stops once unmounted', async () => {
    document.title = 'Form | liveplanner';
    const { rerender, unmount } = renderHook(
      ({ t }: { t: string | null }) => useBrowserTabTitle(t),
      {
        initialProps: { t: null as string | null },
      },
    );
    expect(document.title).toBe('Form | liveplanner');
    rerender({ t: 'Feedback | liveplanner' });
    expect(document.title).toBe('Feedback | liveplanner');
    unmount();
    document.title = 'Elsewhere';
    await new Promise((r) => setTimeout(r, 20));
    expect(document.title).toBe('Elsewhere');
  });
});
