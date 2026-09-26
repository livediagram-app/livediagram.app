// @vitest-environment jsdom

// The owner's share-link actions for tab-scoped links
// (docs/specs/013-workspace/tab-scoped-share-links.md): minting a scoped link, and rescoping one in place.

import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShareLink } from '@/lib/api-client';

const { api, track } = vi.hoisted(() => ({
  api: {
    apiCreateShareLink: vi.fn(),
    apiRescopeShareLink: vi.fn(),
    apiDeleteShareLink: vi.fn(),
    apiExtendShareLink: vi.fn(),
    apiSaveSelf: vi.fn(),
    apiSetSharePassword: vi.fn(),
  },
  track: vi.fn(),
}));
vi.mock('@/lib/api-client', () => api);
vi.mock('@/lib/telemetry', () => ({ track }));

const { useShareLinks } = await import('./useShareLinks');

const link = (over: Partial<ShareLink> = {}): ShareLink => ({
  code: 'CODE2345',
  diagramId: 'd1',
  role: 'view',
  createdAt: 1,
  expiry: 'never',
  expiresAt: null,
  tabId: null,
  ...over,
});

function setup(links: ShareLink[] = []) {
  let state = links;
  const setShareLinks = vi.fn((next: ShareLink[] | ((prev: ShareLink[]) => ShareLink[])) => {
    state = typeof next === 'function' ? next(state) : next;
  });
  const { result } = renderHook(() =>
    useShareLinks({
      diagramId: 'd1',
      selfParticipant: { id: 'me', name: 'Ada', color: '#0ea5e9', status: 'online' },
      setSelfParticipant: vi.fn(),
      setShareLinks,
      setSharePassword: vi.fn(),
      setDiagramShareable: vi.fn(),
      setDiagramShareCode: vi.fn(),
      diagramShareCode: null,
      confirmName: vi.fn(),
    }),
  );
  return { result, links: () => state };
}

beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset();
  track.mockReset();
});

describe('useShareLinks scope', () => {
  it('mints a link scoped to a tab and counts it', async () => {
    api.apiCreateShareLink.mockResolvedValue(link({ tabId: 't2' }));
    const { result, links } = setup();
    await result.current.createShareLink('view', 'never', 't2');
    expect(api.apiCreateShareLink).toHaveBeenCalledWith('me', 'd1', 'view', 'never', 't2');
    expect(links()).toEqual([link({ tabId: 't2' })]);
    expect(track).toHaveBeenCalledWith('Diagram', 'Shared', 'TabScoped');
  });

  it('does not count an All-tabs link as scoped', async () => {
    api.apiCreateShareLink.mockResolvedValue(link());
    const { result } = setup();
    await result.current.createShareLink('view', 'never', null);
    expect(track).not.toHaveBeenCalledWith('Diagram', 'Shared', 'TabScoped');
  });

  it('rescopes a link in place and counts it', async () => {
    api.apiRescopeShareLink.mockResolvedValue(link({ tabId: 't2' }));
    const { result, links } = setup([link(), link({ code: 'OTHER234' })]);
    await result.current.rescopeShareLink('CODE2345', 't2');
    expect(api.apiRescopeShareLink).toHaveBeenCalledWith('me', 'd1', 'CODE2345', 't2');
    expect(links().map((l) => [l.code, l.tabId])).toEqual([
      ['CODE2345', 't2'],
      ['OTHER234', null],
    ]);
    expect(track).toHaveBeenCalledWith('Diagram', 'Shared', 'Rescoped');
  });

  it('leaves the link as it was when the rescope fails', async () => {
    api.apiRescopeShareLink.mockRejectedValue(new Error('nope'));
    const { result, links } = setup([link()]);
    await result.current.rescopeShareLink('CODE2345', 't2');
    expect(links()).toEqual([link()]);
    expect(track).not.toHaveBeenCalled();
  });
});
