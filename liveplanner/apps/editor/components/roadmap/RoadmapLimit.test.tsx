// @vitest-environment jsdom
// docs/specs/026-plan/public-roadmap.md "Tiers", "What the dialog shows": with Pro on, a board not yet published
// while the owner has published every roadmap their tier allows shows who holds the place, the offer for whoever is
// looking, and Publish This One Instead when exactly one roadmap of this plan holds a place. The numbers are the
// list's, or a refused publish's own. With Pro off none of it shows.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PublishedRoadmap, RoadmapBoard, RoadmapsResponse } from '@liveplanner/api-schema';
import { setProForTests } from '@liveworkspace/subscription-ui/testing';
import { ownerOf, proOnForTests, proService, withPro, type Who } from '@/test/pro';
import { roadmapLimitOf, RoadmapLimitReached } from './roadmap-limit';
import { RoadmapDialog } from './RoadmapDialog';

const client = vi.hoisted(() => ({
  readRoadmaps: vi.fn(),
  saveRoadmap: vi.fn(),
  unpublishRoadmap: vi.fn(),
}));
vi.mock('./roadmap-client', () => client);
vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

proOnForTests();
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const SCOPE = { ownerId: 'user_1', projectId: 'p1' };
const BOARD: RoadmapBoard = {
  id: 'b1',
  title: 'Mobile',
  tabName: 'Board',
  tabId: 't1',
  columns: [
    { status: 'todo', name: 'Planned', color: null },
    { status: 'done', name: 'Shipped', color: null },
  ],
  types: [{ id: 'feature', name: 'Feature', glyph: 'sparkles', color: 'violet' }],
  publishable: true,
};
const OTHER: RoadmapBoard = { ...BOARD, id: 'b2', title: 'Product' };
const out = (boardId: string, title: string): PublishedRoadmap => ({
  title,
  columns: ['todo', 'done'],
  types: ['feature'],
  fields: ['description'],
  voting: true,
  formCode: null,
  boardId,
  code: `lpr_${boardId}`,
  path: `/roadmap/p1/lpr_${boardId}`,
  createdAt: 1,
});
const PRODUCT = out('b2', 'Product Roadmap');

async function open(who: Who, over: Partial<RoadmapsResponse>, used = {}) {
  client.readRoadmaps.mockResolvedValue({
    roadmaps: [PRODUCT],
    boards: [BOARD, OTHER],
    forms: [],
    usage: { used: 1, limit: 1 },
    owner: ownerOf(who),
    ...over,
  });
  const service = proService(who, used);
  render(
    withPro(<RoadmapDialog scope={SCOPE} startTabId="t1" onClose={() => {}} />, service.fetcher),
  );
  await waitFor(() =>
    expect(
      document
        .querySelector('[data-roadmap-dialog-state]')!
        .getAttribute('data-roadmap-dialog-state'),
    ).toBe('draft'),
  );
  return service;
}
const panel = () => document.querySelector<HTMLElement>('[data-roadmap-limit]');
const publish = () => screen.getByRole('button', { name: 'Publish Roadmap' });

describe('Publish Roadmap at the owner’s limit', () => {
  it('names this plan’s roadmap that holds the place, offers the upgrade, and leaves Publish to the api', async () => {
    await open('owner', {});
    await waitFor(() => expect(panel()).not.toBeNull());
    await waitFor(() =>
      expect(within(panel()!).getByRole('button', { name: 'Upgrade to Pro' })).toBeTruthy(),
    );
    // A plain card (Planner-Limits), titled by its own heading, not a toned callout with an icon.
    expect(
      within(panel()!).getByRole('heading', { name: 'Publish This Board as a Roadmap' }),
    ).toBeTruthy();
    expect(panel()!.getAttribute('role')).toBe('status');
    expect(panel()!.querySelector('svg')).toBeNull();
    expect(panel()!.textContent).toContain(
      'Free publishes 1 roadmap, and “Product Roadmap” is using it. Pro publishes 10.',
    );
    expect(panel()!.textContent).toContain(
      'Visitors and votes on a published roadmap are never limited.',
    );
    // Never held off by numbers read a while ago: the owner may have upgraded since, and the api decides.
    expect(publish()).toHaveProperty('disabled', false);
  });

  it('in a plan with none out, where the api gives no count, reads the owner’s own count', async () => {
    await open('owner', { roadmaps: [], usage: { limit: 1 } }, { publicRoadmaps: { used: 1 } });
    await waitFor(() => expect(panel()).not.toBeNull());
    expect(panel()!.textContent).toContain(
      'Free publishes 1 roadmap, and a board in another plan is using it.',
    );
  });

  it('recovers after an upgrade with no reload: the list is read again when the window is looked at again', async () => {
    await open('owner', {});
    await waitFor(() => expect(panel()).not.toBeNull());
    // The owner upgraded in another tab and comes back.
    client.readRoadmaps.mockResolvedValue({
      roadmaps: [PRODUCT],
      boards: [BOARD, OTHER],
      forms: [],
      usage: { used: 1, limit: 10 },
      owner: ownerOf('owner'),
    });
    window.dispatchEvent(new Event('focus'));
    await waitFor(() => expect(panel()).toBeNull());
    expect(publish()).toHaveProperty('disabled', false);
  });

  it('in a guest’s plan says to sign in, and offers no upgrade', async () => {
    await open('collaborator', { owner: undefined, guest: true });
    await waitFor(() => expect(document.querySelector('[data-guest-limit]')).not.toBeNull());
    expect(document.querySelector('[data-guest-limit]')!.textContent).toContain(
      'Sign in to keep this plan as your own.',
    );
    expect(screen.getByRole('link', { name: 'Sign In' })).toBeTruthy();
    expect(panel()).toBeNull();
    expect(screen.queryByRole('button', { name: 'Upgrade to Pro' })).toBeNull();
  });

  it('Publish This One Instead asks first, then unpublishes the other and publishes this board', async () => {
    await open('owner', {});
    client.unpublishRoadmap.mockResolvedValue(undefined);
    client.saveRoadmap.mockResolvedValue({ roadmap: out('b1', 'Mobile') });
    fireEvent.click(await screen.findByRole('button', { name: 'Publish This One Instead' }));
    expect(client.unpublishRoadmap).not.toHaveBeenCalled();
    expect(screen.getByText('Unpublish “Product Roadmap” and publish this board?')).toBeTruthy();
    const confirm = screen.getByRole('button', { name: 'Publish Instead' });
    // The count is read again from the api once the swap is done.
    client.readRoadmaps.mockResolvedValue({
      roadmaps: [out('b1', 'Mobile')],
      boards: [BOARD, OTHER],
      forms: [],
      usage: { used: 1, limit: 1 },
      owner: ownerOf('owner'),
    });
    fireEvent.click(confirm);
    await waitFor(() => expect(client.saveRoadmap).toHaveBeenCalled());
    expect(client.unpublishRoadmap).toHaveBeenCalledWith(SCOPE, 'b2');
    expect(client.saveRoadmap.mock.calls[0]!.slice(0, 2)).toEqual([SCOPE, 'b1']);
    expect(client.unpublishRoadmap.mock.invocationCallOrder[0]!).toBeLessThan(
      client.saveRoadmap.mock.invocationCallOrder[0]!,
    );
    expect(await screen.findByText('Your roadmap is live.')).toBeTruthy();
    expect(panel()).toBeNull();
  });

  it('says so plainly when another plan holds the place, with no switch to offer', async () => {
    await open('owner', { roadmaps: [] });
    await waitFor(() =>
      expect(panel()?.textContent).toContain(
        'Free publishes 1 roadmap, and a board in another plan is using it. Unpublish it there to publish this board.',
      ),
    );
    expect(screen.queryByRole('button', { name: 'Publish This One Instead' })).toBeNull();
    await waitFor(() =>
      expect(within(panel()!).getByRole('button', { name: 'Upgrade to Pro' })).toBeTruthy(),
    );
  });

  it('points a team’s member at an admin, and still offers the switch', async () => {
    await open('member', {});
    await waitFor(() =>
      expect(within(panel()!).getByRole('button', { name: 'Ask an Admin' })).toBeTruthy(),
    );
    expect(panel()!.textContent).toContain('A team admin can move this team to Pro for Teams.');
    expect(within(panel()!).queryByRole('button', { name: /Upgrade/ })).toBeNull();
    expect(within(panel()!).getByRole('button', { name: 'Publish This One Instead' })).toBeTruthy();
  });

  it('offers someone outside the owner nothing but the switch, and names no tier', async () => {
    const { calls } = await open('collaborator', {});
    await waitFor(() => expect(calls.some((c) => c.path.startsWith('/owner'))).toBe(true));
    await waitFor(() => expect(panel()).not.toBeNull());
    expect(panel()!.textContent).toContain('This plan’s owner publishes 1 roadmap');
    expect(panel()!.textContent).not.toMatch(/Free|Pro publishes/);
    expect(
      within(panel()!)
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['Publish This One Instead']);
  });

  it('shows no panel while there is room, or on a roadmap already out', async () => {
    await open('owner-pro', { usage: { used: 1, limit: 10 } });
    expect(panel()).toBeNull();
    expect(publish()).toHaveProperty('disabled', false);
    cleanup();
    client.readRoadmaps.mockResolvedValue({
      roadmaps: [out('b1', 'Mobile')],
      boards: [BOARD],
      forms: [],
      usage: { used: 1, limit: 1 },
      owner: ownerOf('owner'),
    });
    const service = proService('owner');
    render(
      withPro(<RoadmapDialog scope={SCOPE} startTabId="t1" onClose={() => {}} />, service.fetcher),
    );
    expect(await screen.findByText('Your roadmap is live.')).toBeTruthy();
    expect(panel()).toBeNull();
  });

  it('a publish the api refuses shows the panel in the refusal’s own numbers', async () => {
    // The service has not said what is published yet: the list holds no count.
    await open('owner', { usage: { limit: 1 } });
    expect(panel()).toBeNull();
    client.saveRoadmap.mockRejectedValue(new RoadmapLimitReached(1, 1));
    fireEvent.click(publish());
    await waitFor(() => expect(panel()).not.toBeNull());
    expect(panel()!.textContent).toContain('“Product Roadmap” is using it');
    expect(screen.queryByText('Couldn’t save. Try again.')).toBeNull();
    expect(publish()).toHaveProperty('disabled', false);
  });

  it('with Pro off shows no panel, publishes as before and asks the service nothing', async () => {
    setProForTests(false);
    const { calls } = await open('owner', {});
    expect(panel()).toBeNull();
    expect(publish()).toHaveProperty('disabled', false);
    expect(calls).toEqual([]);
  });
});

describe('roadmapLimitOf', () => {
  const res = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

  it('reads the refusal’s numbers from a 409 that names the limit', async () => {
    const limit = await roadmapLimitOf(
      res(409, { error: 'roadmap_limit_reached', limit: 'publicRoadmaps', used: 1, max: 1 }),
    );
    expect(limit).toBeInstanceOf(RoadmapLimitReached);
    expect([limit!.used, limit!.max]).toEqual([1, 1]);
  });

  it('is null for any other answer', async () => {
    expect(await roadmapLimitOf(res(409, { error: 'roadmap_form_unknown' }))).toBeNull();
    expect(await roadmapLimitOf(res(200, { roadmap: {} }))).toBeNull();
    expect(await roadmapLimitOf(res(409, { error: 'roadmap_limit_reached' }))).toBeNull();
    expect(await roadmapLimitOf(new Response('nope', { status: 409 }))).toBeNull();
  });
});
