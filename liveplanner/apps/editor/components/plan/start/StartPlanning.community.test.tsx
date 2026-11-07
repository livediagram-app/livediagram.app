// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CommunityStartPost } from '@liveplanner/api-schema';
import { resetCommunityEnabledForTests } from '@liveworkspace/community-ui';
import { resetCommunityStartForTests } from '@liveworkspace/community-ui/start';
import { track } from '@/lib/telemetry';
import { StartPlanning } from './StartPlanning';

vi.mock('@/components/plan/PlanContext', () => ({ usePlan: () => null }));
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

// The Community's Start With read (liveworkspace/docs/specs/007-community/community.md "Start With"): none unless a
// test gives some.
let startTiles: Record<string, CommunityStartPost[]> = {};
let enabled = true;
beforeEach(() => {
  startTiles = {};
  enabled = true;
  resetCommunityStartForTests();
  resetCommunityEnabledForTests();
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) =>
      String(url).includes('/start?')
        ? Response.json({ categories: startTiles })
        : Response.json({ communityEnabled: enabled }),
    ),
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.mocked(track).mockClear();
});

const mount = ({
  onTemplate = vi.fn(),
  leave = vi.fn(),
  withTemplates = true,
}: { onTemplate?: () => void; leave?: (href: string) => void; withTemplates?: boolean } = {}) =>
  render(
    <StartPlanning
      onPickBoard={vi.fn()}
      onTemplate={withTemplates ? onTemplate : undefined}
      leave={leave}
    />,
  );

// docs/specs/026-plan/plan-mode.md "From the Community".
describe('Start Planning, from the Community', () => {
  const tile = (id: string, title: string, category = 'planning'): CommunityStartPost => ({
    id,
    app: 'liveplanner.app',
    title,
    category: category as CommunityStartPost['category'],
    shareCode: `CODE-${id}`,
    likeCount: 9,
    copyCount: 1,
    anonymous: false,
    authorName: 'Ada',
    line: 'How our team plans.',
  });
  const cardIds = () =>
    [...document.querySelectorAll('[data-start-card]')].map((c) =>
      c.getAttribute('data-start-card'),
    );
  const inspiration = () => document.querySelector<HTMLElement>('[data-rail="inspiration"]')!;

  it("follows Inspiration's templates with the Community's tiles, badged, the rail counting templates only", async () => {
    startTiles = {
      planning: [tile('p1', 'Release Train')],
      finance: [tile('f1', 'Team Budget', 'finance'), tile('f2', 'Trip Fund', 'finance')],
    };
    mount();
    const count = inspiration().textContent;
    fireEvent.click(inspiration());
    const first = await screen.findByRole('button', { name: /^Team Budget from the Community/ });
    expect(within(first).getByText('Community')).toBeTruthy();
    expect(within(first).getByText('By Ada')).toBeTruthy();
    expect(first.querySelector('img')!.getAttribute('src')).toBe('/api/share/CODE-f1/image.svg');
    const ids = cardIds();
    // Finance before Projects and Teams, as the categories run.
    expect(ids.slice(-3)).toEqual(['community:f1', 'community:f2', 'community:p1']);
    expect(ids.slice(0, -3).every((id) => id!.startsWith('template:'))).toBe(true);
    expect(inspiration().textContent).toBe(count);
    // Recommended and the other kinds stay Start Planning's own.
    fireEvent.click(document.querySelector('[data-rail="recommended"]')!);
    expect(cardIds().some((id) => id!.startsWith('community:'))).toBe(false);
    fireEvent.click(document.querySelector('[data-rail="boards"]')!);
    expect(cardIds().some((id) => id!.startsWith('community:'))).toBe(false);
  });

  it("opens the person's own copy of a chosen tile, counted as a copy", async () => {
    startTiles = { planning: [tile('p1', 'Release Train')] };
    const onTemplate = vi.fn();
    const leave = vi.fn();
    mount({ onTemplate, leave });
    fireEvent.click(inspiration());
    fireEvent.click(
      await screen.findByRole('button', { name: /^Release Train from the Community/ }),
    );
    expect(leave).toHaveBeenCalledWith('/project/shared?s=CODE-p1&copy=1');
    expect(track).toHaveBeenCalledWith('Community', 'Copied', 'StartWith');
    expect(onTemplate).not.toHaveBeenCalled();
  });

  it('finds a tile by its title in a search', async () => {
    startTiles = { planning: [tile('p1', 'Release Train')] };
    mount();
    fireEvent.click(inspiration());
    await screen.findByRole('button', { name: /^Release Train from the Community/ });
    const search = screen.getByRole('textbox', { name: /^Find a board/ });
    fireEvent.change(search, { target: { value: 'release train' } });
    expect(screen.getByRole('button', { name: /^Release Train from the Community/ })).toBeTruthy();
    fireEvent.change(search, { target: { value: 'zzzz nothing' } });
    expect(screen.queryByRole('button', { name: /from the Community/ })).toBeNull();
  });

  it('shows only its own cards when the Community is off', async () => {
    startTiles = { planning: [tile('p1', 'Release Train')] };
    enabled = false;
    mount();
    fireEvent.click(inspiration());
    await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole('button', { name: /from the Community/ })).toBeNull();
  });

  it('asks nothing where Inspiration is left out', async () => {
    mount({ withTemplates: false });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(fetch).not.toHaveBeenCalled();
  });
});
