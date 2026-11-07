// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommunityStartPost } from '@livediagram/api-schema';
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

const mount = (mode: 'diagram' | 'workshop', onTemplate = vi.fn(), leave = vi.fn()) =>
  render(
    <StartFromTemplates
      key={mode}
      mode={mode}
      tabId="t1"
      onTemplate={onTemplate}
      onOtherModeTemplate={vi.fn()}
      leave={leave}
    />,
  );

describe('StartFromTemplates', () => {
  it('names each mode its own start', () => {
    mount('diagram');
    expect(screen.getByRole('heading', { name: 'Start Diagramming' })).toBeTruthy();
    cleanup();
    mount('workshop');
    expect(screen.getByRole('heading', { name: 'Start a Workshop' })).toBeTruthy();
  });

  it('lands a chosen template, and a blank closes the panel', () => {
    const onTemplate = vi.fn();
    mount('diagram', onTemplate);
    fireEvent.click(document.querySelector('[data-start-card="flowchart"]')!);
    expect(onTemplate).toHaveBeenCalledWith('flowchart');
    fireEvent.click(document.querySelector('[data-start-card="blank"]')!);
    expect(onTemplate).toHaveBeenCalledWith('blank');
    expect(screen.queryByRole('heading', { name: 'Start Diagramming' })).toBeNull();
  });

  it('remembers a close per tab and mode, so switching mode still offers that mode its start', () => {
    mount('diagram');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('heading', { name: 'Start Diagramming' })).toBeNull();
    cleanup();
    mount('diagram');
    expect(screen.queryByRole('heading', { name: 'Start Diagramming' })).toBeNull();
    cleanup();
    mount('workshop');
    expect(screen.getByRole('heading', { name: 'Start a Workshop' })).toBeTruthy();
  });

  it('closes on Escape once its search has nothing to clear', () => {
    mount('diagram');
    const search = screen.getByRole('textbox', { name: 'Find a template' });
    fireEvent.change(search, { target: { value: 'mind' } });
    fireEvent.keyDown(search, { key: 'Escape' });
    expect((search as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('heading', { name: 'Start Diagramming' })).toBeTruthy();
    fireEvent.keyDown(search, { key: 'Escape' });
    expect(screen.queryByRole('heading', { name: 'Start Diagramming' })).toBeNull();
  });
});

// docs/specs/007-editor/start-diagramming.md "On a phone": the sheet stands on the tab bar while it shows, so the tabs
// stay in reach; with the bars folded away (a sideways phone) there is nothing to stand on.
describe('StartFromTemplates on a phone', () => {
  const frameOf = () =>
    screen.getByRole('heading', { name: 'Start Diagramming' }).closest('section')!.parentElement!;

  it('stands on the edge with no tab bar showing', () => {
    mount('diagram');
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
      mount('diagram');
      expect(frameOf().style.getPropertyValue('--start-floor')).toBe('56px');
    } finally {
      vi.unstubAllGlobals();
      bar.remove();
    }
  });
});

describe('StartFromTemplates, switching category', () => {
  it('opens the picked category at the top of its cards', () => {
    mount('diagram');
    const scroller = document.querySelector('[data-start-card]')!.closest('.overflow-y-auto')!;
    scroller.scrollTop = 300;
    fireEvent.click(document.querySelector('[data-rail="processes"]')!);
    expect(scroller.scrollTop).toBe(0);
  });
});

// docs/specs/007-editor/start-diagramming.md "From the Community".
describe('StartFromTemplates, from the Community', () => {
  const tile = (id: string, title: string, category = 'processes'): CommunityStartPost => ({
    id,
    app: 'livediagram.app',
    title,
    category: category as CommunityStartPost['category'],
    shareCode: `CODE-${id}`,
    likeCount: 9,
    copyCount: 1,
    anonymous: false,
    authorName: 'Ada',
    line: 'How our team ships.',
  });
  const cardIds = () =>
    [...document.querySelectorAll('[data-start-card]')].map((c) => c.getAttribute('data-start-card'));

  it("follows a group's templates with its Community tiles, badged, the rail counting templates only", async () => {
    startTiles = { processes: [tile('p1', 'Release Train'), tile('p2', 'Hiring Loop')] };
    mount('diagram');
    const rail = document.querySelector<HTMLElement>('[data-rail="processes"]')!;
    const count = rail.textContent;
    fireEvent.click(rail);
    const first = await screen.findByRole('button', { name: /^Release Train from the Community/ });
    expect(within(first).getByText('Community')).toBeTruthy();
    expect(within(first).getByText('By Ada')).toBeTruthy();
    expect(first.querySelector('img')!.getAttribute('src')).toBe('/api/share/CODE-p1/image.svg');
    const ids = cardIds();
    expect(ids.slice(-2)).toEqual(['community:p1', 'community:p2']);
    expect(ids.slice(0, -2).every((id) => !id!.startsWith('community:'))).toBe(true);
    expect(rail.textContent).toBe(count);
    // Recommended stays templates only.
    fireEvent.click(document.querySelector('[data-rail="recommended"]')!);
    expect(cardIds().some((id) => id!.startsWith('community:'))).toBe(false);
  });

  it("opens the person's own copy of a chosen tile, counted as a copy", async () => {
    startTiles = { processes: [tile('p1', 'Release Train')] };
    const onTemplate = vi.fn();
    const leave = vi.fn();
    mount('diagram', onTemplate, leave);
    fireEvent.click(document.querySelector('[data-rail="processes"]')!);
    fireEvent.click(await screen.findByRole('button', { name: /^Release Train from the Community/ }));
    expect(leave).toHaveBeenCalledWith('/document/shared?s=CODE-p1&copy=1');
    expect(track).toHaveBeenCalledWith('Community', 'Copied', 'StartWith');
    expect(onTemplate).not.toHaveBeenCalled();
  });

  it('finds a tile by its title in a search, after the templates of its group', async () => {
    startTiles = { processes: [tile('p1', 'Release Train')] };
    mount('diagram');
    const search = screen.getByRole('textbox', { name: 'Find a template' });
    fireEvent.change(search, { target: { value: 'release train' } });
    expect(
      await screen.findByRole('button', { name: /^Release Train from the Community/ }),
    ).toBeTruthy();
    fireEvent.change(search, { target: { value: 'zzzz nothing' } });
    expect(screen.queryByRole('button', { name: /from the Community/ })).toBeNull();
  });

  it('shows only templates when the Community is off', async () => {
    startTiles = { processes: [tile('p1', 'Release Train')] };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        String(url).includes('/start?')
          ? Response.json({ categories: startTiles })
          : Response.json({ communityEnabled: false }),
      ),
    );
    mount('diagram');
    fireEvent.click(document.querySelector('[data-rail="processes"]')!);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole('button', { name: /from the Community/ })).toBeNull();
  });

  it('asks nothing while the start is closed', async () => {
    mount('diagram');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    cleanup();
    resetCommunityStartForTests();
    vi.mocked(fetch).mockClear();
    mount('diagram');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetch).not.toHaveBeenCalled();
  });
});
