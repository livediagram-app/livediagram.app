import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeIndex, makeItem } from '../test/fakeClient';
import { Explorer, type ExplorerProps } from '../explorer/Explorer';
import type { WelcomeManifest, WelcomeOptions } from './types';

const MANIFEST: WelcomeManifest = {
  name: 'liveplanner',
  pillFree: 'Free, no trackers',
  blanks: [
    {
      id: 'blank-plan',
      name: 'Blank Plan',
      href: 'https://lp/new?template=blank-plan',
      svg: '<svg/>',
    },
  ],
  popular: [
    {
      id: 'kanban',
      name: 'Kanban Board',
      description: 'Columns',
      href: 'https://lp/new?template=kanban',
    },
  ],
  fan: ['kanban'],
  startBlankHref: 'https://lp/new?start=blank',
  allTemplatesHref: 'https://lp/new',
  searchHref: (q) => `https://lp/new?q=${encodeURIComponent(q)}`,
};

function renderHome(index: ReturnType<typeof createFakeIndex>, over: Partial<ExplorerProps> = {}) {
  const onSelected = vi.fn();
  const onFirstRun = vi.fn();
  const welcome: WelcomeOptions = {
    manifest: MANIFEST,
    signedIn: false,
    signInHref: '/sign-in',
    onSelected,
    onFirstRun,
  };
  render(
    <Explorer
      app="liveplanner"
      client={index.client}
      view={{ kind: 'home' }}
      onNavigate={vi.fn()}
      itemHref={(item) => `/open/${item.id}`}
      onCreate={vi.fn()}
      welcome={welcome}
      {...over}
    />,
  );
  return { onSelected, onFirstRun };
}

describe('Home’s first run', () => {
  beforeEach(() => localStorage.clear());

  it('greets someone with nothing yet with the app’s starts, its template search and a way back', async () => {
    const index = createFakeIndex();
    const { onSelected, onFirstRun } = renderHome(index);
    expect(await screen.findByRole('heading', { name: 'Start Blank' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Popular Templates' })).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(
      'Welcome to liveplanner. What are you making first?',
    );
    expect(screen.getByText('Free, no trackers')).toBeTruthy();
    expect(screen.getByText('No sign-up to start')).toBeTruthy();
    const start = document.querySelector('[data-welcome-start="blank-plan"]') as HTMLAnchorElement;
    expect(start.href).toBe('https://lp/new?template=blank-plan');
    expect(start.querySelector('img')?.getAttribute('src')).toMatch(/^data:image\/svg\+xml/);
    expect(decodeURIComponent(start.querySelector('img')!.getAttribute('src')!)).toContain(
      'xmlns="http://www.w3.org/2000/svg"',
    );
    expect(screen.getByRole('link', { name: 'Browse All Templates' }).getAttribute('href')).toBe(
      'https://lp/new',
    );
    expect(screen.getByRole('link', { name: 'Sign In' }).getAttribute('href')).toBe('/sign-in');
    expect(screen.getByRole('searchbox', { name: 'Search templates' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Start Blank' }).getAttribute('href')).toBe(
      'https://lp/new?start=blank',
    );
    expect(onFirstRun).toHaveBeenCalled();
    fireEvent.click(start);
    expect(onSelected).toHaveBeenCalledWith('Welcome.Blank');
    // One small question for the answer: a single item, in this app.
    const probe = index.calls.find(
      (c) => c.method === 'listItems' && (c.args[0] as { view?: string }).view === 'search',
    );
    expect(probe?.args[0]).toMatchObject({ view: 'search', limit: 1, app: 'liveplanner' });
  });

  it('shows the ordinary Home to someone with anything to open', async () => {
    const index = createFakeIndex({ items: [makeItem(1)] });
    renderHome(index);
    expect(await screen.findByRole('heading', { name: 'Jump Back In' })).toBeTruthy();
    await waitFor(() => expect(index.count('listItems')).toBeGreaterThan(1));
    expect(screen.queryByRole('heading', { name: 'Start Blank' })).toBeNull();
    expect(screen.getByRole('heading', { level: 1 }).textContent).not.toMatch(/Welcome/);
  });

  it('asks nothing without a welcome', async () => {
    const index = createFakeIndex();
    renderHome(index, { welcome: undefined });
    expect(await screen.findByRole('heading', { name: 'Jump Back In' })).toBeTruthy();
    expect(
      index.calls.some(
        (c) => c.method === 'listItems' && (c.args[0] as { view?: string }).view === 'search',
      ),
    ).toBe(false);
  });

  it('offers no way back to someone signed in', async () => {
    const index = createFakeIndex();
    renderHome(index, {
      welcome: { manifest: MANIFEST, signedIn: true, signInHref: '/sign-in' },
    });
    expect(await screen.findByRole('heading', { name: 'Start Blank' })).toBeTruthy();
    expect(screen.getByText('Saved to your account')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Already Have Work?' })).toBeNull();
  });
});
