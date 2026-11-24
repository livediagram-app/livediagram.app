// @vitest-environment jsdom
// liveworkspace/docs/specs/020-ask/ask.md "AI credits": a question the month's credits refused offers the right way on
// to whoever is looking. The owner is offered the upgrade, a team's member is pointed at an admin, and a collaborator
// reads the plain fact.
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ownerOf,
  proOnForTests,
  proService,
  withPro,
  type Who,
} from '@liveworkspace/subscription-ui/testing/who';
import { AskCreditsNotice } from './AskCreditsNotice';

proOnForTests();
afterEach(cleanup);

const MESSAGE = "This month's AI credits are used. Your own AI key still answers.";

function show(who: Who, numbers = true) {
  const onAskAgain = vi.fn();
  const { fetcher } = proService(who);
  render(
    withPro(
      <AskCreditsNotice
        credits={{ owner: ownerOf(who), ...(numbers ? { used: 50, max: 50 } : {}) }}
        message={MESSAGE}
        onAskAgain={onAskAgain}
      />,
      fetcher,
      who,
    ),
  );
  return onAskAgain;
}

const notice = async () =>
  (await screen.findByText(/AI credits are used/)).closest('[data-ask-credits-used]');

describe('AskCreditsNotice', () => {
  it('offers the owner the upgrade', async () => {
    show('owner');
    expect((await notice())?.getAttribute('data-ask-credits-used')).toBe('upgrade');
    expect(screen.getByRole('button', { name: /Upgrade/ })).toBeTruthy();
  });

  it("points a team's member at an admin", async () => {
    show('member');
    expect((await notice())?.getAttribute('data-ask-credits-used')).toBe('ask_admin');
    expect(screen.getByRole('button', { name: 'Ask an Admin' })).toBeTruthy();
  });

  it('tells a collaborator the plain fact, and Ask Again asks again', async () => {
    const onAskAgain = show('collaborator', false);
    expect((await notice())?.getAttribute('data-ask-credits-used')).toBe('none');
    expect(screen.queryByRole('button', { name: /Upgrade|Ask an Admin/ })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Ask Again' }));
    expect(onAskAgain).toHaveBeenCalledTimes(1);
  });
});
