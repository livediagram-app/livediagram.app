// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { SubscriptionProvider } from '@liveworkspace/subscription-ui';
import {
  ME,
  ownerView,
  serviceFetch,
  setProForTests,
  tokenOf,
} from '@liveworkspace/subscription-ui/testing';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { SnapshotsApi } from '../client';
import type { SnapshotListResponse, SnapshotSummary } from '../wire';
import { keepsForATime, useSnapshotsExtras } from './history-snapshots';
import { SnapshotRetentionNote } from './retention-note';
import {
  othersRetentionSentence,
  retentionSentence,
  snapshotKeptUntil,
  snapshotMeta,
} from './snapshot-words';
import { SnapshotsDialog } from './SnapshotsDialog';

// What the dialog and History say of a tier's retention (snapshots.md "With Pro on"): the quiet line and See Pro for
// someone who may upgrade the owner, the sentence alone for a collaborator, each snapshot's expiry, and nothing at
// all with Pro off or on a tier with no age limit.

vi.setConfig({ testTimeout: 30_000 });
beforeAll(async () => {
  await import('./SnapshotsDialog');
}, 60_000);
beforeEach(() => setProForTests(true));
afterEach(() => setProForTests(null));

const NOW = Date.UTC(2026, 10, 20, 12, 0);
const DAY = 24 * 60 * 60 * 1000;
const FREE = { days: 7, owner: ME };

const snap = (over: Partial<SnapshotSummary> = {}): SnapshotSummary => ({
  id: 's_1',
  name: 'Before the Launch',
  kind: 'manual',
  author: { id: 'user_a', name: 'Ada', color: '#f00' },
  createdAt: NOW,
  bytes: 2048,
  ...over,
});

const api = (list: SnapshotListResponse): SnapshotsApi => ({
  list: async () => list,
  take: async () => snap(),
  remove: async () => undefined,
  revert: async () => ({ snapshotId: 's_1', safetySnapshotId: 's_x', generation: 1 }),
});

// The page as an editor mounts it: the provider, answering whether this person may upgrade the owner.
function page(node: React.ReactNode, action: 'upgrade' | 'none' = 'upgrade') {
  const { fetcher } = serviceFetch({ owners: { [ME]: ownerView(ME, action) } });
  return (
    <SubscriptionProvider getToken={tokenOf('tok')} fetch={fetcher}>
      {node}
    </SubscriptionProvider>
  );
}

function Timeline({ list }: { list: SnapshotListResponse }) {
  const extras = useSnapshotsExtras({ api: api(list), noun: 'canvas', viewerId: null }, () => NOW);
  return (
    <div>
      {extras.top}
      <ol>{extras.pins.map((pin) => pin.render(true))}</ol>
    </div>
  );
}

describe('the words', () => {
  it('say how long Free keeps a snapshot, and until when one is kept', () => {
    expect(retentionSentence(7)).toBe('Free keeps snapshots for 7 days. Pro keeps them forever.');
    expect(retentionSentence(1)).toBe('Free keeps snapshots for 1 day. Pro keeps them forever.');
    expect(retentionSentence(7, 'Pro for Teams')).toBe(
      'Free keeps snapshots for 7 days. Pro for Teams keeps them forever.',
    );
    expect(othersRetentionSentence(7)).toBe('Snapshots here are kept for 7 days.');
    expect(othersRetentionSentence(1)).toBe('Snapshots here are kept for 1 day.');
    expect(snapshotKeptUntil(Date.UTC(2026, 10, 27, 12), 'en-GB')).toBe('Kept until 27 Nov');
    const kept = snapshotMeta(snap({ expiresAt: NOW + 7 * DAY }), null, NOW, 'en-GB');
    expect(kept.endsWith(' · Kept until 27 Nov')).toBe(true);
    expect(snapshotMeta(snap(), null, NOW, 'en-GB')).not.toContain('Kept until');
  });
});

describe('the quiet line in the Snapshots dialog', () => {
  it('offers See Pro to someone who may upgrade the owner, and shows each snapshot’s expiry', async () => {
    const list = { snapshots: [snap({ expiresAt: NOW + 7 * DAY })], kept: 5, retention: FREE };
    render(
      page(
        <SnapshotsDialog
          door={{ api: api(list), noun: 'canvas', viewerId: null }}
          onClose={() => {}}
        />,
      ),
    );
    expect(
      await screen.findByText('Free keeps snapshots for 7 days. Pro keeps them forever.'),
    ).toBeTruthy();
    expect(await screen.findByRole('button', { name: 'See Pro' })).toBeTruthy();
    expect(screen.getByText(/Kept until/)).toBeTruthy();
  });

  it('names Pro for Teams to a team’s member, with Ask an Admin', async () => {
    const team = 't:team_garden';
    const list = { snapshots: [snap()], kept: 5, retention: { days: 7, owner: team } };
    const { fetcher } = serviceFetch({ owners: { [team]: ownerView(team, 'ask_admin') } });
    render(
      <SubscriptionProvider getToken={tokenOf('tok')} fetch={fetcher}>
        <SnapshotRetentionNote retention={list.retention} />
      </SubscriptionProvider>,
    );
    expect(await screen.findByRole('button', { name: 'Ask an Admin' })).toBeTruthy();
    expect(screen.getByRole('note').textContent).toContain(
      'Free keeps snapshots for 7 days. Pro for Teams keeps them forever.',
    );
  });

  it('tells a collaborator how long snapshots last, with no tier, no badge and no offer', async () => {
    const list = { snapshots: [snap()], kept: 5, retention: FREE };
    render(
      page(
        <SnapshotsDialog
          door={{ api: api(list), noun: 'canvas', viewerId: null }}
          onClose={() => {}}
        />,
        'none',
      ),
    );
    expect((await screen.findByRole('note')).textContent).toBe(
      'Snapshots here are kept for 7 days.',
    );
    expect(screen.queryByText(/Free/)).toBeNull();
    expect(document.querySelector('[data-pro-badge]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'See Pro' })).toBeNull();
  });

  it('is not drawn on a tier with no age limit, for a list that names no retention, or with Pro off', async () => {
    const paid = { snapshots: [snap()], kept: 50, retention: { days: null, owner: ME } };
    const { unmount } = render(
      page(
        <SnapshotsDialog
          door={{ api: api(paid), noun: 'canvas', viewerId: null }}
          onClose={() => {}}
        />,
      ),
    );
    expect(await screen.findByText('Before the Launch')).toBeTruthy();
    expect(screen.queryByRole('note')).toBeNull();
    expect(screen.getByText(/The latest 50 are kept/)).toBeTruthy();
    unmount();
    const { container } = render(<SnapshotRetentionNote retention={null} />);
    expect(container.innerHTML).toBe('');
    setProForTests(false);
    render(
      <SnapshotsDialog
        door={{
          api: api({ snapshots: [snap()], kept: 5, retention: FREE }),
          noun: 'canvas',
          viewerId: null,
        }}
        onClose={() => {}}
      />,
    );
    expect(await screen.findByText('Before the Launch')).toBeTruthy();
    expect(screen.queryByRole('note')).toBeNull();
  });

  it('offers nothing where the item’s owner is a guest', async () => {
    render(page(<SnapshotRetentionNote retention={{ days: 7, owner: null }} />));
    expect((await screen.findByRole('note')).textContent).toBe(
      'Snapshots here are kept for 7 days.',
    );
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('the quiet line in History', () => {
  it('sits over the timeline while the owner’s tier keeps snapshots for a time', async () => {
    const { container } = render(
      page(<Timeline list={{ snapshots: [snap()], kept: 5, retention: FREE }} />),
    );
    expect(await screen.findByText(/Free keeps snapshots/)).toBeTruthy();
    expect(container.querySelector('[data-history-snapshots]')).toBeTruthy();
    expect(keepsForATime(FREE)).toBe(true);
  });

  it('adds no block with Pro off, or where snapshots are kept', async () => {
    expect(keepsForATime(null)).toBe(false);
    expect(keepsForATime({ days: null, owner: ME })).toBe(false);
    setProForTests(false);
    expect(keepsForATime(FREE)).toBe(false);
    const { container } = render(
      <Timeline list={{ snapshots: [snap()], kept: 5, retention: FREE }} />,
    );
    expect(await screen.findByText('Before the Launch')).toBeTruthy();
    expect(container.querySelector('[data-history-snapshots]')).toBeNull();
  });
});
