// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import { preloadUpgradeDialog } from '../provider/SubscriptionProvider';
import { useUpgrade } from '../provider/hooks';
import { GARDEN, meResponse, serviceFetch, team, withProvider } from '../test/fixture';

// subscription.md "What people see", "The upgrade dialog": a press that comes before the dialog's code. Nothing
// here loads the dialogs ahead of the test, so its press is the one that fetches them (dialog-open.test.tsx has the
// press that finds the code in).

function Openers() {
  const { openUpgrade } = useUpgrade();
  return (
    <>
      <button onClick={() => openUpgrade()}>Open Upgrade</button>
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

// The provider's working half is in before the test (its first import is slow on a busy machine), the dialogs not:
// importing the driver fetches neither dialog.
beforeAll(async () => {
  await import('../provider/SubscriptionDriver');
}, 60_000);

describe('opening the upgrade dialog before its code is in', () => {
  it('keeps the press: the dialog opens when the code lands', async () => {
    await openers();
    press('Open Upgrade');
    expect(screen.queryByRole('dialog')).toBeNull();
    await act(async () => {
      await preloadUpgradeDialog();
    });
    expect(screen.getByRole('dialog', { name: 'One Upgrade, Every App' })).toBeTruthy();
  });
});
