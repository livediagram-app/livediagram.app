// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommunityStartPost } from '@livedesign/api-schema';
import { resetCommunityEnabledForTests } from '@liveworkspace/community-ui';
import { resetCommunityStartForTests } from '@liveworkspace/community-ui/start';
import { track } from '@/lib/telemetry';
import { StartFromTemplates } from './StartFromTemplates';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// The Community's Start With read (liveworkspace/docs/specs/007-community/community.md "Start With"): none unless a
// test gives some.
let startTiles: Record<string, CommunityStartPost[]> = {};
beforeEach(() => {
  startTiles = {};
  resetCommunityStartForTests();
  resetCommunityEnabledForTests();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      String(url).includes('/start?')
        ? Response.json({ categories: startTiles })
        : Response.json({ communityEnabled: true }),
    ),
  );
});

// docs/specs/007-editor/start-diagramming.md
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.mocked(track).mockClear();
});

const mount = (onTemplate = vi.fn(), tabId = 't1', leave = vi.fn()) =>
  render(<StartFromTemplates mode="pages" tabId={tabId} onTemplate={onTemplate} leave={leave} />);

describe('StartFromTemplates', () => {
  it('names its start', () => {
    mount();
    expect(screen.getByRole('heading', { name: 'Start Making Pages' })).toBeTruthy();
  });

  it('lands a chosen template', () => {
    const onTemplate = vi.fn();
    mount(onTemplate);
    fireEvent.click(document.querySelector('[data-start-card="logo-design"]')!);
    expect(onTemplate).toHaveBeenCalledWith('logo-design');
  });

  it('stays open for a template that lands content', () => {
    mount();
    fireEvent.click(document.querySelector('[data-start-card="logo-design"]')!);
    expect(screen.getByRole('heading', { name: 'Start Making Pages' })).toBeTruthy();
  });

  it('remembers a close per tab', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('heading', { name: 'Start Making Pages' })).toBeNull();
    cleanup();
    mount();
    expect(screen.queryByRole('heading', { name: 'Start Making Pages' })).toBeNull();
    cleanup();
    mount(vi.fn(), 't2');
    expect(screen.getByRole('heading', { name: 'Start Making Pages' })).toBeTruthy();
  });

  it('closes on Escape once its search has nothing to clear', () => {
    mount();
    const search = screen.getByRole('textbox', { name: 'Find a template' });
    fireEvent.change(search, { target: { value: 'slide' } });
    fireEvent.keyDown(search, { key: 'Escape' });
    expect((search as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('heading', { name: 'Start Making Pages' })).toBeTruthy();
    fireEvent.keyDown(search, { key: 'Escape' });
    expect(screen.queryByRole('heading', { name: 'Start Making Pages' })).toBeNull();
  });
});

// docs/specs/007-editor/start-diagramming.md "On a phone": the sheet stands on the tab bar while it shows, so the tabs
// stay in reach; with the bars folded away (a sideways phone) there is nothing to stand on.
describe('StartFromTemplates on a phone', () => {
  const frameOf = () =>
    screen.getByRole('heading', { name: 'Start Making Pages' }).closest('section')!.parentElement!;

  it('stands on the edge with no tab bar showing', () => {
    mount();
    expect(frameOf().className).toContain('max-sm:pb-[calc(var(--start-floor)-8px)]');
    expect(frameOf().style.getPropertyValue('--start-floor')).toBe('16px');
  });

  it('stands on the tab bar where it shows', () => {
    const bar = document.createElement('div');
    bar.setAttribute('data-editor-tabbar', '');
    bar.getBoundingClientRect = () =>
      ({ top: 616, left: 0, right: 390, width: 390, height: 48 }) as DOMRect;
    document.body.appendChild(bar);
    vi.stubGlobal('innerWidth', 390);
    vi.stubGlobal('innerHeight', 664);
    try {
      mount();
      expect(frameOf().style.getPropertyValue('--start-floor')).toBe('56px');
    } finally {
      vi.unstubAllGlobals();
      bar.remove();
    }
  });
});

describe('StartFromTemplates, switching category', () => {
  it('opens the picked category at the top of its cards', () => {
    mount();
    const scroller = document.querySelector('[data-start-card]')!.closest('.overflow-y-auto')!;
    scroller.scrollTop = 300;
    fireEvent.click(document.querySelector('[data-rail="websites"]')!);
    expect(scroller.scrollTop).toBe(0);
  });
});

// docs/specs/007-editor/start-diagramming.md "From the Community".
describe('StartFromTemplates, from the Community', () => {
  const tile = (id: string, title: string, category = 'websites'): CommunityStartPost => ({
    id,
    app: 'livedesign.app',
    title,
    category: category as CommunityStartPost['category'],
    shareCode: `CODE-${id}`,
    likeCount: 9,
    copyCount: 1,
    anonymous: false,
    authorName: 'Ada',
    line: 'Our bakery, on the web.',
  });
  const cardIds = () =>
    [...document.querySelectorAll('[data-start-card]')].map((c) =>
      c.getAttribute('data-start-card'),
    );
  const hasCommunity = () => cardIds().some((id) => id!.startsWith('community:'));

  it("follows a category's templates with its Community tiles, badged, the rail counting templates only", async () => {
    startTiles = { websites: [tile('w1', 'Bakery Landing'), tile('w2', 'Help Centre')] };
    mount();
    const rail = document.querySelector<HTMLElement>('[data-rail="websites"]')!;
    const count = rail.textContent;
    fireEvent.click(rail);
    const first = await screen.findByRole('button', { name: /^Bakery Landing from the Community/ });
    expect(within(first).getByText('Community')).toBeTruthy();
    expect(within(first).getByText('By Ada')).toBeTruthy();
    expect(first.querySelector('img')!.getAttribute('src')).toMatch(
      /\/share\/CODE-w1\/image\.svg$/,
    );
    const ids = cardIds();
    expect(ids.slice(-2)).toEqual(['community:w1', 'community:w2']);
    expect(ids.slice(0, -2).every((id) => !id!.startsWith('community:'))).toBe(true);
    expect(rail.textContent).toBe(count);
    // Recommended and Blank Pages stay templates only.
    fireEvent.click(document.querySelector('[data-rail="recommended"]')!);
    expect(hasCommunity()).toBe(false);
    fireEvent.click(document.querySelector('[data-rail="blank-pages"]')!);
    expect(hasCommunity()).toBe(false);
  });

  it("opens the person's own copy of a chosen tile, counted as a copy", async () => {
    startTiles = { websites: [tile('w1', 'Bakery Landing')] };
    const onTemplate = vi.fn();
    const leave = vi.fn();
    mount(onTemplate, 't1', leave);
    fireEvent.click(document.querySelector('[data-rail="websites"]')!);
    fireEvent.click(
      await screen.findByRole('button', { name: /^Bakery Landing from the Community/ }),
    );
    expect(leave).toHaveBeenCalledWith('/design/shared?s=CODE-w1&copy=1');
    expect(track).toHaveBeenCalledWith('Community', 'Copied', 'StartWith');
    expect(onTemplate).not.toHaveBeenCalled();
  });

  it('finds a tile by its title in a search, after the templates of its category', async () => {
    startTiles = { websites: [tile('w1', 'Bakery Landing')] };
    mount();
    const search = screen.getByRole('textbox', { name: 'Find a template' });
    fireEvent.change(search, { target: { value: 'bakery landing' } });
    expect(
      await screen.findByRole('button', { name: /^Bakery Landing from the Community/ }),
    ).toBeTruthy();
    fireEvent.change(search, { target: { value: 'zzzz nothing' } });
    expect(screen.queryByRole('button', { name: /from the Community/ })).toBeNull();
  });

  it('shows only templates when the Community is off', async () => {
    startTiles = { websites: [tile('w1', 'Bakery Landing')] };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        String(url).includes('/start?')
          ? Response.json({ categories: startTiles })
          : Response.json({ communityEnabled: false }),
      ),
    );
    mount();
    fireEvent.click(document.querySelector('[data-rail="websites"]')!);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole('button', { name: /from the Community/ })).toBeNull();
  });

  it('asks nothing while the start is closed', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    cleanup();
    resetCommunityStartForTests();
    vi.mocked(fetch).mockClear();
    mount();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetch).not.toHaveBeenCalled();
  });
});
