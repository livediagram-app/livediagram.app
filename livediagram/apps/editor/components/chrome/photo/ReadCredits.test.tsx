// @vitest-environment jsdom
// docs/specs/021-event-storming/note-reader.md "What the editor shows": on the review, the quiet line that a read uses
// one AI credit (with what is left for the diagram's owner or the owning team), and, once the month's are used, the
// right way on for whoever is looking. With Pro off, or a read the api did not count, nothing is drawn.
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setProForTests } from '@liveworkspace/subscription-ui/testing';
import {
  noteReadCredits,
  noteReadCreditsUsed,
  resetReadCreditsForTests,
} from '@/lib/reading/read-credits';
import { ownerOf, proOnForTests, proService, withPro, type Who } from '@/test/pro';
import { PhotoStatus } from './PhotoStatus';

proOnForTests();
// A fixed day, so the credits come back on the first of December.
const FIRST = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
}).format(Date.UTC(2026, 11, 1));
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: Date.UTC(2026, 10, 20, 12) });
});
afterEach(() => {
  cleanup();
  act(() => resetReadCreditsForTests());
  vi.useRealTimers();
});

function review(who: Who, reading = true) {
  const service = proService(who);
  return {
    ...service,
    ...render(
      withPro(
        <PhotoStatus
          detecting={false}
          foundNothing={false}
          revealed={4}
          detected={4}
          reading={reading}
          readError={null}
        />,
        service.fetcher,
        who,
      ),
    ),
  };
}
const counted = (who: Who) =>
  act(() => noteReadCredits({ owner: ownerOf(who), pass: 'p', used: 12, max: 50 }));
const used = (who: Who) =>
  act(() => noteReadCreditsUsed({ owner: ownerOf(who), used: 50, max: 50 }));

describe('a counted read', () => {
  it('tells the owner the cost and what is left', async () => {
    review('owner');
    expect(screen.queryByTestId('photo-credits')).toBeNull();
    counted('owner');
    const line = await screen.findByTestId('photo-credits');
    await vi.waitFor(() =>
      expect(line.textContent).toBe('Uses 1 AI credit· 38 of 50 left this month'),
    );
  });

  it('says the real count the api spent, while and after', async () => {
    const { rerender, fetcher } = review('owner');
    act(() => noteReadCredits({ owner: ownerOf('owner'), pass: 'p', cost: 3, used: 12, max: 50 }));
    const line = await screen.findByTestId('photo-credits');
    await vi.waitFor(() => expect(line.textContent).toContain('Uses 3 AI credits'));
    rerender(
      withPro(
        <PhotoStatus
          detecting={false}
          foundNothing={false}
          revealed={4}
          detected={4}
          reading={false}
          readError={null}
        />,
        fetcher,
        'owner',
      ),
    );
    await vi.waitFor(() =>
      expect(screen.getByTestId('photo-credits').textContent).toContain('Used 3 AI credits'),
    );
  });

  it('says it in the past once the photo is read', async () => {
    review('member', false);
    counted('member');
    const line = await screen.findByTestId('photo-credits');
    await vi.waitFor(() =>
      expect(line.textContent).toBe('Used 1 AI credit· 38 of 50 left this month'),
    );
  });

  it.each(['collaborator', 'guest'] as const)(
    'tells a %s the cost alone, never what the owner has left',
    async (who) => {
      const { calls } = review(who);
      counted(who);
      const line = await screen.findByTestId('photo-credits');
      if (who === 'collaborator') {
        await vi.waitFor(() => expect(calls.some((c) => c.path.startsWith('/owner'))).toBe(true));
      }
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
      });
      expect(line.textContent).toBe('Uses 1 AI credit');
    },
  );
});

describe('the month’s credits are used', () => {
  it('offers the owner the upgrade, and says the photo is read here', async () => {
    review('owner');
    used('owner');
    const notice = await screen.findByTestId('photo-credits-used');
    expect(notice.textContent).toContain('This Month’s 50 AI Credits Are Used');
    expect(notice.textContent).toContain(
      `They come back on ${FIRST}. This photo is being read on this device instead. Pro has 1,000 a month.`,
    );
    expect(screen.getByRole('button', { name: 'Upgrade to Pro' })).toBeTruthy();
    expect(screen.queryByTestId('photo-credits')).toBeNull();
  });

  it('offers a team admin the team’s upgrade', async () => {
    review('admin');
    used('admin');
    expect(await screen.findByRole('button', { name: 'Upgrade Team' })).toBeTruthy();
    expect(screen.getByTestId('photo-credits-used').textContent).toContain(
      'Pro for Teams has 500 a member a month.',
    );
  });

  it('points a team’s member at an admin', async () => {
    review('member');
    used('member');
    expect(await screen.findByRole('button', { name: 'Ask an Admin' })).toBeTruthy();
    expect(screen.getByTestId('photo-credits-used').textContent).toContain(
      'This Month’s 50 AI Credits Are Used',
    );
    expect(screen.queryByRole('button', { name: /Upgrade/ })).toBeNull();
  });

  it.each(['collaborator', 'guest'] as const)(
    'tells a %s only that they are used: no number, no offer, nothing of the owner',
    async (who) => {
      review(who);
      used(who);
      const notice = await screen.findByTestId('photo-credits-used');
      expect(notice.textContent).toBe(
        'This month’s AI credits are used. This photo is being read on this device instead.',
      );
      expect(notice.getAttribute('data-read-credits')).toBe('none');
      expect(screen.queryByRole('button', { name: /Upgrade|Ask an Admin|See Pro/ })).toBeNull();
    },
  );
});

describe('with Pro off', () => {
  it('draws nothing and asks nothing, whatever was noted', async () => {
    setProForTests(false);
    const { calls, container } = review('owner');
    const before = container.textContent;
    counted('owner');
    used('owner');
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 30));
    });
    expect(container.textContent).toBe(before);
    expect(screen.queryByTestId('photo-credits-used')).toBeNull();
    expect(calls).toEqual([]);
  });
});
