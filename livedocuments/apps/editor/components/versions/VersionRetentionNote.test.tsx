// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SubscriptionProvider } from '@liveworkspace/subscription-ui';
import {
  ME,
  ownerView,
  serviceFetch,
  setProForTests,
  tokenOf,
} from '@liveworkspace/subscription-ui/testing';
import type { VersionSummary } from '@livedocuments/api-schema';
import { VersionRail, NOW } from './VersionRail';
import {
  VersionRetentionNote,
  versionRetentionOthersSentence,
  versionRetentionSentence,
} from './VersionRetentionNote';

// The rail's closing line with Pro on (docs/specs/006-document/version-history.md "With Pro on"): See Pro for someone
// who may upgrade the document's owner, how long history lasts (no tier) for a collaborator, nothing with Pro off or
// on Pro.

beforeEach(() => setProForTests(true));
afterEach(() => {
  cleanup();
  setProForTests(null);
});

const version: VersionSummary = {
  id: 'v_1',
  tabId: 't1',
  rev: 2,
  kind: 'idle',
  name: null,
  author: null,
  savedAt: Date.UTC(2026, 10, 19, 9),
  createdAt: Date.UTC(2026, 10, 19, 10),
  bytes: 10,
  elementCount: 1,
};

function page(node: React.ReactNode, action: 'upgrade' | 'none' = 'upgrade') {
  const { fetcher } = serviceFetch({ owners: { [ME]: ownerView(ME, action) } });
  return (
    <SubscriptionProvider getToken={tokenOf('tok')} fetch={fetcher}>
      {node}
    </SubscriptionProvider>
  );
}

const rail = (retention: { days: number | null; owner: string | null } | null) => (
  <VersionRail
    list={{ state: 'ready', versions: [version], retention }}
    selected={NOW}
    onSelect={() => {}}
    canEdit={false}
    onNameCurrent={async () => {}}
    onRename={async () => {}}
    onRetry={() => {}}
    now={Date.UTC(2026, 10, 20)}
  />
);

describe('the rail’s retention line', () => {
  it('words what the server said', () => {
    expect(versionRetentionSentence(7)).toBe('Free keeps 7 days of history. Pro keeps it forever.');
    expect(versionRetentionSentence(1)).toBe('Free keeps 1 day of history. Pro keeps it forever.');
    expect(versionRetentionOthersSentence(7)).toBe('History here is kept for 7 days.');
    expect(versionRetentionOthersSentence(1)).toBe('History here is kept for 1 day.');
  });

  it('offers See Pro to someone who may upgrade the owner', async () => {
    render(page(rail({ days: 7, owner: ME })));
    expect(
      await screen.findByText('Free keeps 7 days of history. Pro keeps it forever.'),
    ).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'See Pro' })).toBeTruthy();
  });

  it('tells a collaborator how long history lasts with no tier and no offer, and a guest’s reader too', async () => {
    const { unmount } = render(page(rail({ days: 7, owner: ME }), 'none'));
    expect((await screen.findByRole('note')).textContent).toBe('History here is kept for 7 days.');
    expect(screen.queryByText(/Free keeps/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'See Pro' })).toBeNull();
    unmount();
    render(page(<VersionRetentionNote retention={{ days: 7, owner: null }} />));
    expect(screen.getByRole('note').textContent).toBe('History here is kept for 7 days.');
    expect(screen.queryByRole('button', { name: 'See Pro' })).toBeNull();
  });

  it('is not drawn on a tier with no age limit, without a retention, or with Pro off', () => {
    const { rerender } = render(page(rail({ days: null, owner: ME })));
    expect(screen.queryByRole('note')).toBeNull();
    rerender(page(rail(null)));
    expect(screen.queryByRole('note')).toBeNull();
    setProForTests(false);
    rerender(rail({ days: 7, owner: ME }));
    expect(screen.queryByRole('note')).toBeNull();
  });
});
