// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, renderHook, waitFor } from '@testing-library/react';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { useBrowserTabTitle } from './useBrowserTabTitle';

afterEach(() => {
  cleanup();
  document.title = '';
});

describe('useBrowserTabTitle', () => {
  it('sets the title, and puts it back when the route metadata rewrites it after hydration', async () => {
    document.title = 'Form | liveplanner';
    renderHook(() => useBrowserTabTitle('Job Application | liveplanner'));
    expect(document.title).toBe('Job Application | liveplanner');
    // Next.js commits the page's static metadata <title> a moment later, over the text the effect wrote.
    document.querySelector('title')!.textContent = 'Form | liveplanner';
    await waitFor(() => expect(document.title).toBe('Job Application | liveplanner'));
  });

  it('leaves the title alone while there is none to show, and stops watching once unmounted', async () => {
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

// The editor's tab title ("<plan> | liveplanner") went back to the bare "liveplanner" once Next.js committed the
// route's metadata title after hydration: the editor route holds it with this hook, never a one-off assignment.
describe('the editor route’s tab title', () => {
  it('is held with useBrowserTabTitle, never set with document.title', () => {
    const dir = join(__dirname, '../../app/project/[id]/');
    const files = readdirSync(dir).filter((f) => /\.tsx?$/.test(f) && !/\.test\./.test(f));
    const assigning = files.filter((f) => /document.title\s*=/.test(readFileSync(dir + f, 'utf8')));
    expect(assigning).toEqual([]);
    expect(readFileSync(`${dir}editor-page.tsx`, 'utf8')).toMatch(/useBrowserTabTitle\(/);
  });
});
