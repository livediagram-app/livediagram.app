// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SubscriptionProvider } from '@liveworkspace/subscription-ui';
import {
  GARDEN,
  ME,
  ownerView,
  serviceFetch,
  setProForTests,
  tokenOf,
} from '@liveworkspace/subscription-ui/testing';
import { PublishLimit } from './PublishLimit';

// Publish to the Web at the owner's tier's limit (docs/specs/030-knowledgebase/publishing.md "What the dialog
// shows"): the offer for who may take it, Ask an Admin for a team's member, the plain limit for anyone else.

beforeEach(() => setProForTests(true));
afterEach(() => {
  cleanup();
  setProForTests(null);
});

const FULL =
  'You have 1 public Knowledgebase, the most Free publishes. Unpublish one to publish this';
const shown = (owner: string | undefined, action: 'upgrade' | 'ask_admin' | 'none') => {
  const views = owner ? { [owner]: ownerView(owner as typeof ME, action) } : {};
  const { fetcher } = serviceFetch({ owners: views });
  return render(
    <SubscriptionProvider getToken={tokenOf('tok')} fetch={fetcher}>
      <PublishLimit owner={owner} used={1} max={1} />
    </SubscriptionProvider>,
  );
};

describe('PublishLimit', () => {
  it('offers Pro to the owner', async () => {
    shown(ME, 'upgrade');
    expect(await screen.findByText(`${FULL}, or publish up to 10 with Pro.`)).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Upgrade to Pro' })).toBeTruthy();
  });

  it('points a team’s member at an admin, without the offer', async () => {
    shown(GARDEN, 'ask_admin');
    expect(await screen.findByRole('button', { name: 'Ask an Admin' })).toBeTruthy();
    expect(screen.getByText(new RegExp(`^${FULL}\\. A team admin`))).toBeTruthy();
  });

  it('says the plain limit to anyone else, and for a guest’s knowledgebase', async () => {
    shown(ME, 'none');
    expect(await screen.findByText(`${FULL}.`)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
    cleanup();
    shown(undefined, 'none');
    expect(screen.getByText(`${FULL}.`)).toBeTruthy();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
