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

  // A status screen (Canvas Not Found) names the tab over the item's own title, which the page still holds.
  it('lets a status screen name the tab over the item, and hands it back when the screen goes', async () => {
    const page = renderHook(({ t }: { t: string }) => useBrowserTabTitle(t), {
      initialProps: { t: 'Untitled canvas | livediagram' },
    });
    const screen = renderHook(() =>
      useBrowserTabTitle('Canvas Not Found | livediagram', { status: true }),
    );
    expect(document.title).toBe('Canvas Not Found | livediagram');
    // The item's title changing under the screen does not take the tab back.
    page.rerender({ t: 'Roadmap | livediagram' });
    expect(document.title).toBe('Canvas Not Found | livediagram');
    document.querySelector('title')!.textContent = 'livediagram';
    await waitFor(() => expect(document.title).toBe('Canvas Not Found | livediagram'));
    screen.unmount();
    expect(document.title).toBe('Roadmap | livediagram');
    page.unmount();
  });

  // Among equals the latest mounted holder names the tab, and the earlier one takes it back when that one goes.
  it('lets the latest of two status screens, or of two items, name the tab', () => {
    const first = renderHook(() => useBrowserTabTitle('Plan A | liveplanner'));
    const second = renderHook(() => useBrowserTabTitle('Plan B | liveplanner'));
    expect(document.title).toBe('Plan B | liveplanner');
    const archived = renderHook(() =>
      useBrowserTabTitle('Archived | liveplanner', { status: true }),
    );
    const missing = renderHook(() =>
      useBrowserTabTitle('Not Found | liveplanner', { status: true }),
    );
    expect(document.title).toBe('Not Found | liveplanner');
    missing.unmount();
    expect(document.title).toBe('Archived | liveplanner');
    archived.unmount();
    expect(document.title).toBe('Plan B | liveplanner');
    second.unmount();
    expect(document.title).toBe('Plan A | liveplanner');
    first.unmount();
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
