// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { preloadUpgradeDialog } from '../provider/SubscriptionProvider';
import { useUpgrade } from '../provider/hooks';
import { GARDEN, meResponse, serviceFetch, team, withProvider } from '../test/fixture';

// subscription.md "What people see", "The upgrade dialog": a press that finds the dialogs' code in. This file's
// one test is each dialog's first draw, the draw that used to wait on a suspended render even with the code loaded:
// a page busy enough (a test polling a role query over a large page, on a loaded machine) could starve that render
// for seconds. dialog-open-unloaded.test.tsx has the press that comes before the code.

function Openers() {
  const { openUpgrade, openAskAdmin } = useUpgrade();
  return (
    <>
      <button onClick={() => openUpgrade()}>Open Upgrade</button>
      <button onClick={() => openAskAdmin({ owner: GARDEN })}>Open Ask an Admin</button>
    </>
  );
}

/** The openers under a provider whose working half is in and has read the subscription. */
async function openers() {
  const { fetcher, calls } = serviceFetch({
    me: meResponse({ teams: [team(GARDEN, 'Garden Club', 'member')] }),
  });
  render(withProvider(<Openers />, fetcher));
  await waitFor(() => expect(calls.some((call) => call.path === '/me')).toBe(true));
}

const press = (name: string) => fireEvent.click(screen.getByRole('button', { name }));

beforeAll(async () => {
  await preloadUpgradeDialog();
}, 60_000);

describe('opening the dialogs with their code in', () => {
  it('each dialog is drawn by the press itself, with nothing to wait for', async () => {
    await openers();
    press('Open Upgrade');
    expect(screen.getByRole('dialog', { name: 'One Upgrade, Every App' })).toBeTruthy();
    press('Open Ask an Admin');
    expect(screen.getByRole('dialog', { name: 'Ask an Admin About Pro' })).toBeTruthy();
  });
});
