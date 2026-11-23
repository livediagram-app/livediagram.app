// @vitest-environment jsdom
// docs/specs/030-forms/forms.md "Abuse and limits → Tiers": with Pro on a form whose owner's month of responses is
// used reads Paused to its editors, with why and the offer for whoever is looking, and the owner's month's meter to
// the owner alone; the public page says one neutral line that names no tier. With Pro off the status bar is as it
// always was.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FormLinkResponse } from '@liveplanner/api-schema';
import { closedMessageOf } from '@liveplanner/forms';
import { setProForTests } from '@liveworkspace/subscription-ui/testing';
import type { FormLinkState } from '@/hooks/forms/useFormLink';
import { ownerOf, proOnForTests, proService, withPro, type Who } from '@/test/pro';
import { FormMonth } from './FormMonth';
import { FormStatusBar } from './FormStatusBar';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn() }));

proOnForTests();
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: Date.UTC(2026, 10, 20, 12) });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const DAY = new Intl.DateTimeFormat(undefined, {
  day: 'numeric',
  month: 'long',
  timeZone: 'UTC',
}).format(Date.UTC(2026, 11, 1));

const linkOf = (who: Who, over: Partial<FormLinkResponse> = {}): FormLinkResponse => ({
  link: { code: 'c', open: true, createdAt: 0 },
  responses: 250,
  unseen: 0,
  suspendedAt: null,
  canPublish: true,
  month: { limit: 500, full: true },
  owner: ownerOf(who),
  ...over,
});

// The owner has used 500 of this month's responses, over every form they own.
const USED = { formResponses: { used: 500 } };

function bar(
  who: Who,
  over: Partial<FormLinkResponse> = {},
  onOpenResponses = vi.fn(),
  used: typeof USED = USED,
) {
  const service = proService(who, used);
  const link = { status: 'ready', link: linkOf(who, over) } as unknown as FormLinkState;
  render(
    withPro(
      <FormStatusBar
        link={link}
        problem={null}
        canEdit
        onFix={() => {}}
        onOpenResponses={onOpenResponses}
      />,
      service.fetcher,
    ),
  );
  return { ...service, onOpenResponses };
}
const notice = () => document.querySelector<HTMLElement>('[data-form-month] [data-callout]')!;
// It waits for the service to say who is looking: found once it has.
const settled = () => waitFor(() => expect(notice()).not.toBeNull());

describe('a form whose month is full', () => {
  it('reads Paused, shows the owner’s month’s meter, and offers the owner the upgrade', async () => {
    const { onOpenResponses } = bar('owner');
    expect(screen.getByText('Paused')).toBeTruthy();
    expect(screen.queryByText('Accepting Responses')).toBeNull();
    // It opens again by itself: never the red Not Taking Responses.
    expect(screen.queryByText('Not Taking Responses')).toBeNull();
    await settled();
    expect(
      screen
        .getByRole('meter', { name: 'Form responses this month' })
        .getAttribute('aria-valuetext'),
    ).toBe('500 of 500');
    await waitFor(() =>
      expect(within(notice()).getByRole('button', { name: 'Upgrade to Pro' })).toBeTruthy(),
    );
    expect(notice().textContent).toContain(
      `Your forms have taken Free’s 500 responses for the month. This form takes responses again on ${DAY}, or now with 10,000 a month on Pro.`,
    );
    fireEvent.click(within(notice()).getByRole('button', { name: 'View Responses' }));
    expect(onOpenResponses).toHaveBeenCalled();
  });

  it('points a team’s member at an admin', async () => {
    bar('member');
    await settled();
    await waitFor(() =>
      expect(within(notice()).getByRole('button', { name: 'Ask an Admin' })).toBeTruthy(),
    );
    expect(notice().textContent).toContain(
      'This team’s forms have taken Free’s 500 responses for the month.',
    );
    expect(notice().textContent).not.toContain('or now with');
    expect(within(notice()).queryByRole('button', { name: /Upgrade/ })).toBeNull();
  });

  it('tells a collaborator what happened, naming no tier and offering nothing', async () => {
    const { calls } = bar('collaborator');
    await waitFor(() => expect(calls.some((c) => c.path.startsWith('/owner'))).toBe(true));
    await waitFor(() =>
      expect(notice()?.textContent).toBe(
        `This plan’s owner has used this month’s form responses. This form takes responses again on ${DAY}.View Responses`,
      ),
    );
    expect(
      within(notice())
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(['View Responses']);
    // What the owner used is theirs alone.
    expect(screen.queryByRole('meter')).toBeNull();
  });

  it('below the limit still reads Accepting Responses, with no notice in the bar', async () => {
    const { calls } = bar('owner', { month: { limit: 500, full: false } }, vi.fn(), {
      formResponses: { used: 499 },
    });
    await waitFor(() => expect(calls.some((c) => c.path.startsWith('/owner'))).toBe(true));
    expect(screen.getByText('Accepting Responses')).toBeTruthy();
    expect(document.querySelector('[data-form-month]')).toBeNull();
  });

  it('reads Paused as soon as the owner’s count reaches the limit, before any response is turned away', async () => {
    bar('owner', { month: { limit: 500, full: false } });
    await settled();
    expect(screen.getByText('Paused')).toBeTruthy();
    expect(notice().textContent).toContain(
      'Your forms have taken Free’s 500 responses for the month.',
    );
  });

  it('with Pro off is as it always was, and asks the service nothing', () => {
    setProForTests(false);
    const { calls } = bar('owner');
    expect(screen.getByText('Accepting Responses')).toBeTruthy();
    expect(screen.queryByText('Paused')).toBeNull();
    expect(document.querySelector('[data-form-month]')).toBeNull();
    expect(calls).toEqual([]);
  });
});

describe('the month’s meter in Share Form and Settings', () => {
  it('counts the owner’s month while there is room, with no notice', async () => {
    const service = proService('owner', { formResponses: { used: 120 } });
    render(
      withPro(
        <FormMonth link={linkOf('owner', { month: { limit: 500, full: false } })} />,
        service.fetcher,
      ),
    );
    expect(
      (await screen.findByRole('meter', { name: 'Form responses this month' })).getAttribute(
        'aria-valuetext',
      ),
    ).toBe('120 of 500');
    expect(screen.queryByRole('status')).toBeNull();
  });

  it('is nothing to a collaborator while there is room', () => {
    const service = proService('collaborator');
    const { container } = render(
      withPro(
        <FormMonth link={linkOf('collaborator', { month: { limit: 500, full: false } })} />,
        service.fetcher,
      ),
    );
    expect(container.querySelector('[data-form-month]')).toBeNull();
  });

  it('is nothing when the link read says nothing of the month', () => {
    const service = proService('owner');
    const { month: _month, owner: _owner, ...plain } = linkOf('owner');
    const { container } = render(withPro(<FormMonth link={plain} />, service.fetcher));
    expect(container.querySelector('[data-form-month]')).toBeNull();
  });
});

describe('the public page', () => {
  it('says one neutral line for a full month, whatever the form’s own closed message', () => {
    const message = closedMessageOf({ closedMessage: 'Back next year.' }, 'monthly_limit');
    expect(message).toBe("This form isn't accepting responses right now. Please try again later.");
    expect(message).not.toMatch(/Free|Pro|limit|month|upgrade/i);
  });
});
