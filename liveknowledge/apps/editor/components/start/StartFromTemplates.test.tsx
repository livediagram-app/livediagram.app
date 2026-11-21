// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommunityStartPost } from '@liveknowledge/api-schema';
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

// docs/specs/030-knowledgebase/describe-to-set-up.md "The start screen"
afterEach(() => {
  cleanup();
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.mocked(track).mockClear();
});

const mount = (
  onTemplate = vi.fn(),
  leave = vi.fn(),
  foot: { onDescribe?: () => void; onImport?: () => void } = {},
) => render(<StartFromTemplates onTemplate={onTemplate} leave={leave} {...foot} />);
const TITLE = 'Start Your Knowledgebase';

describe('StartFromTemplates', () => {
  it('names its start', () => {
    mount();
    expect(screen.getByRole('heading', { name: TITLE })).toBeTruthy();
  });

  it('leads with Blank Knowledgebase, and offers no slide, infographic or canvas', () => {
    const onTemplate = vi.fn();
    mount(onTemplate);
    expect(document.querySelector('[data-rail]')!.getAttribute('data-rail')).toBe('start');
    const first = document.querySelector('[data-start-card]')!;
    expect(first.textContent).toContain('Blank Knowledgebase');
    fireEvent.click(screen.getByRole('button', { name: /^Blank Knowledgebase/ }));
    expect(onTemplate).toHaveBeenCalledWith('blank');
    for (const word of ['Slide', 'Infographic', 'Canvas'])
      expect(document.body.textContent).not.toContain(`Blank ${word}`);
  });

  it('offers Describe to Set Up and Import at the rail foot when given, each opening its dialog', () => {
    const onDescribe = vi.fn();
    const onImport = vi.fn();
    mount(vi.fn(), vi.fn(), { onDescribe, onImport });
    fireEvent.click(document.querySelector('[data-rail="describe"]')!);
    expect(onDescribe).toHaveBeenCalledTimes(1);
    fireEvent.click(document.querySelector('[data-rail="import"]')!);
    expect(onImport).toHaveBeenCalledTimes(1);
  });

  it('offers neither where they are not given', () => {
    mount();
    expect(document.querySelector('[data-rail="describe"]')).toBeNull();
    expect(document.querySelector('[data-rail="import"]')).toBeNull();
  });

  it('cannot be closed: no ×, no grab handle, and Escape only clears a search', () => {
    mount();
    expect(screen.queryByRole('button', { name: 'Close' })).toBeNull();
    expect(document.querySelector('[data-sheet-handle]')).toBeNull();
    const search = screen.getByRole('textbox', { name: 'Find a template' });
    fireEvent.change(search, { target: { value: 'slide' } });
    fireEvent.keyDown(search, { key: 'Escape' });
    expect((search as HTMLInputElement).value).toBe('');
    fireEvent.keyDown(search, { key: 'Escape' });
    expect(screen.getByRole('heading', { name: TITLE })).toBeTruthy();
  });
});

// docs/specs/007-editor/start-diagramming.md "On a phone": the sheet stands on the tab bar while it shows, so the tabs
// stay in reach; with the bars folded away (a sideways phone) there is nothing to stand on.
describe('StartFromTemplates on a phone', () => {
  const frameOf = () =>
    screen.getByRole('heading', { name: TITLE }).closest('section')!.parentElement!;

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
    fireEvent.click(document.querySelector('[data-rail="handbooks"]')!);
    expect(scroller.scrollTop).toBe(0);
  });
});

// docs/specs/007-editor/start-diagramming.md "From the Community".
describe('StartFromTemplates, from the Community', () => {
  const tile = (id: string, title: string, category = 'product'): CommunityStartPost => ({
    id,
    app: 'liveknowledge.app',
    title,
    category: category as CommunityStartPost['category'],
    shareCode: `CODE-${id}`,
    likeCount: 9,
    copyCount: 1,
    anonymous: false,
    authorName: 'Ada',
    line: 'How our quarter went.',
  });

  it("opens the person's own copy of a chosen tile, counted as a copy", async () => {
    startTiles = { product: [tile('r1', 'Annual Report')] };
    const onTemplate = vi.fn();
    const leave = vi.fn();
    mount(onTemplate, leave);
    fireEvent.click(document.querySelector('[data-rail="product"]')!);
    fireEvent.click(
      await screen.findByRole('button', { name: /^Annual Report from the Community/ }),
    );
    expect(leave).toHaveBeenCalledWith('/document/shared?s=CODE-r1&copy=1');
    expect(track).toHaveBeenCalledWith('Community', 'Copied', 'StartWith');
    expect(onTemplate).not.toHaveBeenCalled();
  });

  it('finds a tile by its title in a search, after the templates of its group', async () => {
    startTiles = { product: [tile('r1', 'Annual Report')] };
    mount();
    const search = screen.getByRole('textbox', { name: 'Find a template' });
    fireEvent.change(search, { target: { value: 'annual report' } });
    expect(
      await screen.findByRole('button', { name: /^Annual Report from the Community/ }),
    ).toBeTruthy();
    fireEvent.change(search, { target: { value: 'zzzz nothing' } });
    expect(screen.queryByRole('button', { name: /from the Community/ })).toBeNull();
  });

  it('shows only templates when the Community is off', async () => {
    startTiles = { product: [tile('r1', 'Annual Report')] };
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        String(url).includes('/start?')
          ? Response.json({ categories: startTiles })
          : Response.json({ communityEnabled: false }),
      ),
    );
    mount();
    fireEvent.click(document.querySelector('[data-rail="product"]')!);
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole('button', { name: /from the Community/ })).toBeNull();
  });
});
