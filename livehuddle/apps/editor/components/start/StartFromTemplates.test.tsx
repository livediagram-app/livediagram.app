// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommunityStartPost } from '@livehuddle/api-schema';
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

const mount = (mode: 'workshop', onTemplate = vi.fn(), leave = vi.fn()) =>
  render(
    <StartFromTemplates key={mode} mode={mode} tabId="t1" onTemplate={onTemplate} leave={leave} />,
  );

describe('StartFromTemplates', () => {
  it('names each mode its own start', () => {
    mount('workshop');
    expect(screen.getByRole('heading', { name: 'Start a Space' })).toBeTruthy();
    cleanup();
    mount('workshop');
    expect(screen.getByRole('heading', { name: 'Start a Space' })).toBeTruthy();
  });

  // "Recommended leads": the start opens on Recommended, the blank first.
  it('opens on Recommended', () => {
    const onTemplate = vi.fn();
    mount('workshop', onTemplate);
    expect(document.querySelector('[data-start-card="focus-library"]')).toBeNull();
    expect(document.querySelector('[data-start-card="blank-session"]')).not.toBeNull();
    fireEvent.click(document.querySelector('[data-start-card="virtual-office"]')!);
    expect(onTemplate).toHaveBeenCalledWith('virtual-office');
  });

  it('lands a chosen template, and a blank closes the panel', () => {
    const onTemplate = vi.fn();
    mount('workshop', onTemplate);
    fireEvent.click(screen.getByRole('button', { name: /^Recommended/ }));
    fireEvent.click(document.querySelector('[data-start-card="team-pod"]')!);
    expect(onTemplate).toHaveBeenCalledWith('team-pod');
    fireEvent.click(document.querySelector('[data-start-card="blank-session"]')!);
    expect(onTemplate).toHaveBeenCalledWith('blank-session');
    expect(screen.queryByRole('heading', { name: 'Start a Space' })).toBeNull();
  });

  // docs/specs/009-elements/avatar-pad.md "Every Space and blank tab has one": the × starts from a blank space.
  it('starts from the blank on a close, apart from a pick', () => {
    const onTemplate = vi.fn();
    const onStartBlank = vi.fn();
    render(
      <StartFromTemplates
        mode="workshop"
        tabId="t1"
        onTemplate={onTemplate}
        onStartBlank={onStartBlank}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(onStartBlank).toHaveBeenCalledExactlyOnceWith('blank-session');
    expect(onTemplate).not.toHaveBeenCalled();
  });

  it('starts from the blank on Escape too', () => {
    const onStartBlank = vi.fn();
    render(
      <StartFromTemplates
        mode="workshop"
        tabId="t1"
        onTemplate={vi.fn()}
        onStartBlank={onStartBlank}
      />,
    );
    fireEvent.keyDown(screen.getByRole('textbox', { name: 'Find a template' }), { key: 'Escape' });
    expect(onStartBlank).toHaveBeenCalledExactlyOnceWith('blank-session');
  });

  it('remembers a close on its tab', () => {
    mount('workshop');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('heading', { name: 'Start a Space' })).toBeNull();
    cleanup();
    mount('workshop');
    expect(screen.queryByRole('heading', { name: 'Start a Space' })).toBeNull();
  });

  it('closes on Escape once its search has nothing to clear', () => {
    mount('workshop');
    const search = screen.getByRole('textbox', { name: 'Find a template' });
    fireEvent.change(search, { target: { value: 'mind' } });
    fireEvent.keyDown(search, { key: 'Escape' });
    expect((search as HTMLInputElement).value).toBe('');
    expect(screen.getByRole('heading', { name: 'Start a Space' })).toBeTruthy();
    fireEvent.keyDown(search, { key: 'Escape' });
    expect(screen.queryByRole('heading', { name: 'Start a Space' })).toBeNull();
  });
});

// docs/specs/007-editor/start-diagramming.md "On a phone": the sheet stands on the tab bar while it shows, so the tabs
// stay in reach; with the bars folded away (a sideways phone) there is nothing to stand on.
describe('StartFromTemplates on a phone', () => {
  const frameOf = () =>
    screen.getByRole('heading', { name: 'Start a Space' }).closest('section')!.parentElement!;

  it('stands on the edge with no tab bar showing', () => {
    mount('workshop');
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
      mount('workshop');
      expect(frameOf().style.getPropertyValue('--start-floor')).toBe('56px');
    } finally {
      vi.unstubAllGlobals();
      bar.remove();
    }
  });
});

describe('StartFromTemplates, switching category', () => {
  it('opens the picked category at the top of its cards', () => {
    mount('workshop');
    const scroller = document.querySelector('[data-start-card]')!.closest('.overflow-y-auto')!;
    scroller.scrollTop = 300;
    fireEvent.click(document.querySelector('[data-rail="recommended"]')!);
    expect(scroller.scrollTop).toBe(0);
  });
});

// docs/specs/007-editor/start-diagramming.md "From the Community".
describe('StartFromTemplates, from the Community', () => {
  const tile = (id: string, title: string, category = 'office'): CommunityStartPost => ({
    id,
    app: 'livehuddle.app',
    title,
    category: category as CommunityStartPost['category'],
    shareCode: `CODE-${id}`,
    likeCount: 9,
    copyCount: 1,
    anonymous: false,
    authorName: 'Ada',
    line: 'Where our team meets.',
  });
  const cardIds = () =>
    [...document.querySelectorAll('[data-start-card]')].map((c) =>
      c.getAttribute('data-start-card'),
    );

  it("follows a group's templates with its Community tiles, badged, the rail counting templates only", async () => {
    startTiles = { office: [tile('p1', 'Rooftop Office'), tile('p2', 'Quiet Floor')] };
    mount('workshop');
    const rail = document.querySelector<HTMLElement>('[data-rail="office"]')!;
    const count = rail.textContent;
    fireEvent.click(rail);
    const first = await screen.findByRole('button', { name: /^Rooftop Office from the Community/ });
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
    startTiles = { office: [tile('p1', 'Rooftop Office')] };
    const onTemplate = vi.fn();
    const leave = vi.fn();
    mount('workshop', onTemplate, leave);
    fireEvent.click(document.querySelector('[data-rail="office"]')!);
    fireEvent.click(
      await screen.findByRole('button', { name: /^Rooftop Office from the Community/ }),
    );
    expect(leave).toHaveBeenCalledWith('/document/shared?s=CODE-p1&copy=1');
    expect(track).toHaveBeenCalledWith('Community', 'Copied', 'StartWith');
    expect(onTemplate).not.toHaveBeenCalled();
  });

  it('finds a tile by its title in a search, after the templates of its group', async () => {
    startTiles = { office: [tile('p1', 'Rooftop Office')] };
    mount('workshop');
    const search = screen.getByRole('textbox', { name: 'Find a template' });
    fireEvent.change(search, { target: { value: 'rooftop office' } });
    expect(
      await screen.findByRole('button', { name: /^Rooftop Office from the Community/ }),
    ).toBeTruthy();
    fireEvent.change(search, { target: { value: 'zzzz nothing' } });
    expect(screen.queryByRole('button', { name: /from the Community/ })).toBeNull();
  });

  it('shows only templates when the Community is off', async () => {
    startTiles = { office: [tile('p1', 'Rooftop Office')] };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        String(url).includes('/start?')
          ? Response.json({ categories: startTiles })
          : Response.json({ communityEnabled: false }),
      ),
    );
    mount('workshop');
    fireEvent.click(document.querySelector('[data-rail="office"]')!);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole('button', { name: /from the Community/ })).toBeNull();
  });

  it('asks nothing while the start is closed', async () => {
    mount('workshop');
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    cleanup();
    resetCommunityStartForTests();
    vi.mocked(fetch).mockClear();
    mount('workshop');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetch).not.toHaveBeenCalled();
  });
});
