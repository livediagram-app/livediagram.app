// @vitest-environment jsdom
// docs/specs/026-plan/calendar-feed.md "Subscribe to Calendar": the person's own feed read fresh, in its three states
// (Off, Just made, On); Make Calendar Link with the options chosen, the link shown once to copy or hand to a
// calendar, an option change that saves at once and keeps the link (and goes back when the save fails), Reset Link
// and Turn Off behind their confirms, the privacy note in every state, and the read and write failures.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarFeedResponse } from '@liveplanner/api-schema';
import { CalendarFeedDialog } from './CalendarFeedDialog';
import { CalendarFeedHost } from './CalendarFeedHost';
import { useCalendarFeedToolsItem } from './calendar-feed-tools-item';
import { feedSummary } from './CalendarFeedOptions';

const client = vi.hoisted(() => ({
  readCalendarFeed: vi.fn(),
  issueCalendarFeed: vi.fn(),
  changeCalendarFeed: vi.fn(),
  turnOffCalendarFeed: vi.fn(),
  readMyWorkCalendarFeed: vi.fn(),
  issueMyWorkCalendarFeed: vi.fn(),
  turnOffMyWorkCalendarFeed: vi.fn(),
}));
vi.mock('./calendar-feed-client', () => client);
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

const SCOPE = { ownerId: 'user_1', projectId: 'p1' };
const PLAN = { kind: 'plan', scope: SCOPE } as const;
const MY_WORK = { kind: 'my-work', ownerId: 'user_1' } as const;
const TYPES = [
  { id: 'feature', name: 'Feature', glyph: 'sparkles', color: 'violet' },
  { id: 'bug', name: 'Bug', glyph: 'bug', color: 'red' },
];
// A card type's pill, in Card Types.
const pill = (name: string) =>
  within(screen.getByRole('group', { name: 'Card Types' })).getByRole('button', { name });
const MADE = Date.UTC(2026, 10, 3);
const FEED = { typeIds: null, mine: false, includeDone: false, createdAt: MADE };
const PATH = '/api/calendar/p1/lpf_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG.ics';
const writeText = vi.fn();

const answer = (r: CalendarFeedResponse) => client.readCalendarFeed.mockResolvedValue(r);
const open = async (r: CalendarFeedResponse, onClose = vi.fn()) => {
  answer(r);
  render(<CalendarFeedDialog target={PLAN} onClose={onClose} />);
  await screen.findByText('What It Shows');
  return onClose;
};
const stateOf = () =>
  document.querySelector('[data-calendar-feed-state]')!.getAttribute('data-calendar-feed-state');
const confirmIn = (label: string) =>
  fireEvent.click(
    within(document.querySelector('[data-confirm-popover]') as HTMLElement).getByRole('button', {
      name: label,
    }),
  );

beforeEach(() => {
  writeText.mockResolvedValue(undefined);
  Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
});
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Off', () => {
  it('makes the link with the options chosen, and shows it once to copy or hand on', async () => {
    await open({ feed: null, types: TYPES });
    expect(stateOf()).toBe('off');
    expect(screen.getByText(/Anyone with this link can see the titles and dates/)).toBeTruthy();
    expect(pill('All Types').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(pill('Bug'));
    expect(pill('Bug').getAttribute('aria-pressed')).toBe('true');
    expect(pill('All Types').getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByRole('switch', { name: /Only My Cards/ }));
    // Include Done Cards on and off again: the link is made without done cards.
    fireEvent.click(screen.getByRole('switch', { name: /Include Done Cards/ }));
    fireEvent.click(screen.getByRole('switch', { name: /Include Done Cards/ }));
    // Choosing in Off saves nothing yet.
    expect(client.changeCalendarFeed).not.toHaveBeenCalled();

    client.issueCalendarFeed.mockResolvedValue({
      feed: { typeIds: ['bug'], mine: true, includeDone: false, createdAt: MADE },
      path: PATH,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Make Calendar Link' }));
    const field = await screen.findByLabelText<HTMLInputElement>('Calendar link');
    expect(client.issueCalendarFeed).toHaveBeenCalledWith(
      SCOPE,
      expect.objectContaining({ typeIds: ['bug'], mine: true, includeDone: false }),
    );
    expect(track).toHaveBeenCalledWith('Plan', 'Created', 'CalendarFeed');
    expect(stateOf()).toBe('made');
    expect(field.value).toMatch(/^https?:\/\/[^/]+\/api\/calendar\/p1\/lpf_[A-Za-z0-9]{43}\.ics$/);
    // The keyboard follows to Copy Link, the control that took Make Calendar Link's place.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Copy Link' }));
    expect(screen.getByText(/only time the link is shown/)).toBeTruthy();
    expect(screen.getByText(/In Outlook, choose Add Calendar/)).toBeTruthy();

    const google = screen.getByRole('link', { name: 'Google Calendar' });
    expect(google.getAttribute('href')).toContain(
      'https://calendar.google.com/calendar/r?cid=webcal',
    );
    expect(google.getAttribute('rel')).toBe('noopener noreferrer');
    fireEvent.click(google);
    expect(track).toHaveBeenCalledWith('Plan', 'Shared', 'CalendarFeedGoogle');
    const apple = screen.getByRole('link', { name: 'Apple Calendar' });
    expect(apple.getAttribute('href')).toMatch(/^webcal:\/\//);
    fireEvent.click(apple);
    expect(track).toHaveBeenCalledWith('Plan', 'Shared', 'CalendarFeedApple');

    fireEvent.click(screen.getByRole('button', { name: 'Copy Link' }));
    await screen.findByRole('button', { name: 'Copied' });
    expect(writeText).toHaveBeenCalledWith(field.value);
    expect(track).toHaveBeenCalledWith('Plan', 'Copied', 'CalendarFeed');
    expect(screen.getByRole('status').textContent).toBe('Calendar link copied');
  });

  it('selects the link to copy by hand when the clipboard refuses', async () => {
    await open({ feed: null, types: TYPES });
    client.issueCalendarFeed.mockResolvedValue({ feed: FEED, path: PATH });
    fireEvent.click(screen.getByRole('button', { name: 'Make Calendar Link' }));
    const field = await screen.findByLabelText<HTMLInputElement>('Calendar link');
    writeText.mockRejectedValue(new Error('denied'));
    fireEvent.click(screen.getByRole('button', { name: 'Copy Link' }));
    await waitFor(() => expect(document.activeElement).toBe(field));
    expect(track).not.toHaveBeenCalledWith('Plan', 'Copied', 'CalendarFeed');
  });

  it('says so when the link cannot be made, and stays Off', async () => {
    await open({ feed: null, types: [] });
    client.issueCalendarFeed.mockRejectedValue(new Error('500'));
    fireEvent.click(screen.getByRole('button', { name: 'Make Calendar Link' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Couldn’t save. Try again.');
    expect(stateOf()).toBe('off');
  });

  it('closes from Done once the link is shown, and from the header', async () => {
    const onClose = await open({ feed: null, types: [] });
    client.issueCalendarFeed.mockResolvedValue({ feed: FEED, path: PATH });
    fireEvent.click(screen.getByRole('button', { name: 'Make Calendar Link' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('On', () => {
  it('says when the link was made, never shows it, and reads the options it was made with', async () => {
    await open({ feed: { ...FEED, typeIds: ['feature'], includeDone: true }, types: TYPES });
    expect(stateOf()).toBe('on');
    expect(screen.getByText(/^Your calendar link is on\. Made .*2026\.$/)).toBeTruthy();
    expect(screen.queryByLabelText('Calendar link')).toBeNull();
    expect(pill('Feature').getAttribute('aria-pressed')).toBe('true');
    expect(pill('Bug').getAttribute('aria-pressed')).toBe('false');
    expect(
      screen.getByRole('switch', { name: /Include Done Cards/ }).getAttribute('aria-checked'),
    ).toBe('true');
    expect(screen.getByText(/Anyone with this link can see the titles and dates/)).toBeTruthy();
  });

  it('saves a changed option at once, keeping the link', async () => {
    await open({ feed: FEED, types: TYPES });
    client.changeCalendarFeed.mockResolvedValue({ feed: { ...FEED, mine: true } });
    fireEvent.click(screen.getByRole('switch', { name: /Only My Cards/ }));
    await waitFor(() =>
      expect(client.changeCalendarFeed).toHaveBeenCalledWith(
        SCOPE,
        expect.objectContaining({ typeIds: null, mine: true, includeDone: false }),
      ),
    );
    expect(track).toHaveBeenCalledWith('Plan', 'Changed', 'CalendarFeedOptions');
    expect(client.issueCalendarFeed).not.toHaveBeenCalled();
    expect(stateOf()).toBe('on');
  });

  it('puts an option back when its save fails, and says so', async () => {
    await open({ feed: FEED, types: TYPES });
    client.changeCalendarFeed.mockRejectedValue(new Error('500'));
    const mine = screen.getByRole('switch', { name: /Only My Cards/ });
    fireEvent.click(mine);
    expect((await screen.findByRole('alert')).textContent).toBe('Couldn’t save. Try again.');
    expect(mine.getAttribute('aria-checked')).toBe('false');
  });

  it('picks All Types again, which saves every type and lets an old feed’s board go', async () => {
    await open({ feed: { ...FEED, typeIds: ['feature'], boardId: 'b1' }, types: TYPES });
    client.changeCalendarFeed.mockResolvedValue({ feed: FEED });
    fireEvent.click(pill('All Types'));
    await waitFor(() =>
      expect(client.changeCalendarFeed).toHaveBeenCalledWith(SCOPE, {
        typeIds: null,
        boardId: null,
        mine: false,
        includeDone: false,
      }),
    );
  });

  it('resets the link behind its confirm, and shows the new one', async () => {
    await open({ feed: FEED, types: TYPES });
    fireEvent.click(screen.getByRole('button', { name: 'Reset Link' }));
    expect(screen.getByText(/stops working at once/)).toBeTruthy();
    client.issueCalendarFeed.mockResolvedValue({
      feed: { ...FEED, createdAt: MADE + 1 },
      path: PATH,
    });
    confirmIn('Reset Link');
    await screen.findByLabelText('Calendar link');
    expect(client.issueCalendarFeed).toHaveBeenCalledWith(
      SCOPE,
      expect.objectContaining({ typeIds: null, mine: false, includeDone: false }),
    );
    expect(track).toHaveBeenCalledWith('Plan', 'Changed', 'CalendarFeedLink');
    expect(stateOf()).toBe('made');
  });

  it('cancels a confirm without a change', async () => {
    await open({ feed: FEED, types: TYPES });
    fireEvent.click(screen.getByRole('button', { name: 'Turn Off' }));
    fireEvent.click(
      within(document.querySelector('[data-confirm-popover]') as HTMLElement).getByRole('button', {
        name: 'Cancel',
      }),
    );
    expect(document.querySelector('[data-confirm-popover]')).toBeNull();
    expect(client.turnOffCalendarFeed).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Reset Link' }));
    fireEvent.click(
      within(document.querySelector('[data-confirm-popover]') as HTMLElement).getByRole('button', {
        name: 'Cancel',
      }),
    );
    expect(document.querySelector('[data-confirm-popover]')).toBeNull();
    expect(client.issueCalendarFeed).not.toHaveBeenCalled();
  });

  it('turns off behind its confirm, back to Off with Make Calendar Link focused', async () => {
    await open({ feed: FEED, types: TYPES });
    fireEvent.click(screen.getByRole('button', { name: 'Turn Off' }));
    expect(screen.getByText('Calendars using it stop updating.')).toBeTruthy();
    client.turnOffCalendarFeed.mockResolvedValue(undefined);
    confirmIn('Turn Off');
    const make = await screen.findByRole('button', { name: 'Make Calendar Link' });
    expect(client.turnOffCalendarFeed).toHaveBeenCalledWith(SCOPE);
    expect(track).toHaveBeenCalledWith('Plan', 'Ended', 'CalendarFeed');
    expect(stateOf()).toBe('off');
    expect(document.activeElement).toBe(make);
  });

  it('stays On and says so when turning off fails', async () => {
    await open({ feed: FEED, types: TYPES });
    fireEvent.click(screen.getByRole('button', { name: 'Turn Off' }));
    client.turnOffCalendarFeed.mockRejectedValue(new Error('500'));
    confirmIn('Turn Off');
    expect((await screen.findByRole('alert')).textContent).toBe('Couldn’t save. Try again.');
    expect(stateOf()).toBe('on');
  });
});

describe('reading', () => {
  it('shows a quiet loading row, then a failure with Try Again that reads again', async () => {
    client.readCalendarFeed.mockRejectedValueOnce(new Error('503'));
    render(<CalendarFeedDialog target={PLAN} onClose={vi.fn()} />);
    expect(stateOf()).toBe('loading');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Couldn’t load your calendar link.',
    );
    expect(stateOf()).toBe('error');
    answer({ feed: null, types: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    await screen.findByText('What It Shows');
    expect(stateOf()).toBe('off');
  });
});

// "The My Work feed": the same dialog for the person's own cards across plans, with no options, its own copy and
// its own telemetry types.
describe('the My Work feed', () => {
  const MY_PATH = '/api/calendar/my-work/lpf_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG.ics';
  const openMine = async (feed: { createdAt: number } | null) => {
    client.readMyWorkCalendarFeed.mockResolvedValue({ feed });
    render(<CalendarFeedDialog target={MY_WORK} onClose={vi.fn()} />);
    await waitFor(() => expect(stateOf()).not.toBe('loading'));
  };

  it('makes the link with no options, copies and hands it on as the My Work feed', async () => {
    await openMine(null);
    expect(stateOf()).toBe('off');
    expect(screen.getByText('Your cards in your own calendar.')).toBeTruthy();
    expect(screen.getByText(/Every open card assigned to you, in any plan you own/)).toBeTruthy();
    expect(screen.queryByText('What It Shows')).toBeNull();
    expect(document.querySelector('[data-calendar-feed-privacy]')).toBeTruthy();
    client.issueMyWorkCalendarFeed.mockResolvedValue({ feed: { createdAt: MADE }, path: MY_PATH });
    fireEvent.click(screen.getByRole('button', { name: 'Make Calendar Link' }));
    await waitFor(() => expect(stateOf()).toBe('made'));
    expect(client.issueMyWorkCalendarFeed).toHaveBeenCalledWith('user_1');
    expect(track).toHaveBeenCalledWith('Plan', 'Created', 'MyWorkCalendarFeed');
    fireEvent.click(screen.getByRole('button', { name: 'Copy Link' }));
    await waitFor(() => expect(track).toHaveBeenCalledWith('Plan', 'Copied', 'MyWorkCalendarFeed'));
    fireEvent.click(screen.getByText('Google Calendar'));
    expect(track).toHaveBeenCalledWith('Plan', 'Shared', 'MyWorkCalendarFeedGoogle');
    fireEvent.click(screen.getByText('Apple Calendar'));
    expect(track).toHaveBeenCalledWith('Plan', 'Shared', 'MyWorkCalendarFeedApple');
    expect(client.readCalendarFeed).not.toHaveBeenCalled();
  });

  it('resets and turns off the person’s own feed', async () => {
    await openMine({ createdAt: MADE });
    expect(stateOf()).toBe('on');
    client.issueMyWorkCalendarFeed.mockResolvedValue({ feed: { createdAt: MADE }, path: MY_PATH });
    fireEvent.click(screen.getByRole('button', { name: 'Reset Link' }));
    confirmIn('Reset Link');
    await waitFor(() => expect(stateOf()).toBe('made'));
    expect(track).toHaveBeenCalledWith('Plan', 'Changed', 'MyWorkCalendarFeedLink');
    cleanup();
    await openMine({ createdAt: MADE });
    client.turnOffMyWorkCalendarFeed.mockResolvedValue(undefined);
    fireEvent.click(screen.getByRole('button', { name: 'Turn Off' }));
    confirmIn('Turn Off');
    await waitFor(() => expect(stateOf()).toBe('off'));
    expect(client.turnOffMyWorkCalendarFeed).toHaveBeenCalledWith('user_1');
    expect(track).toHaveBeenCalledWith('Plan', 'Ended', 'MyWorkCalendarFeed');
  });
});

describe('the summary', () => {
  it('says in one sentence what the calendar will hold', () => {
    const base = { typeIds: null, mine: false, includeDone: false };
    expect(feedSummary([], base)).toBe(
      'Every card with a Start or Due date, leaving out done ones.',
    );
    expect(feedSummary(['Bug', 'Task', 'Idea'], { ...base, mine: true, includeDone: true })).toBe(
      'Every Bug, Task and Idea card that names you with a Start or Due date, done ones included.',
    );
  });
});

// The Tools menu's row, as a plain button: what the footer's Tools popover draws for it, its badge beside its name.
function Row() {
  const item = useCalendarFeedToolsItem();
  if (!item) return null;
  return (
    <button
      type="button"
      data-badge={item.badges?.join(', ') ?? ''}
      onClick={() => item.onSelect(null)}
    >
      {item.label}
    </button>
  );
}

describe('the door', () => {
  it('draws no row for someone who may not have a feed', () => {
    render(
      <CalendarFeedHost scope={null}>
        <Row />
      </CalendarFeedHost>,
    );
    expect(screen.queryByRole('button', { name: 'Subscribe to Calendar' })).toBeNull();
  });

  it('opens the dialog from its Tools row', async () => {
    answer({ feed: null, types: [] });
    render(
      <CalendarFeedHost scope={SCOPE}>
        <Row />
      </CalendarFeedHost>,
    );
    const row = screen.getByRole('button', { name: 'Subscribe to Calendar' });
    expect(row.getAttribute('data-badge')).toBe('');
    fireEvent.click(row);
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'CalendarFeed');
    expect(await screen.findByText('What It Shows')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    await waitFor(() => expect(screen.queryByText('What It Shows')).toBeNull());
  });

  // liveworkspace/docs/specs/004-index/footer-tools-menu.md "Always there": shown with a badge, opening the gate.
  it('shows a guest the row with Sign In, opening the sign-in gate back to the feed', () => {
    render(
      <CalendarFeedHost scope={null} gate={{ kind: 'sign_in' }}>
        <Row />
      </CalendarFeedHost>,
    );
    const row = screen.getByRole('button', { name: 'Subscribe to Calendar' });
    expect(row.getAttribute('data-badge')).toBe('Sign In');
    fireEvent.click(row);
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'CalendarFeedSignIn');
    const href = screen.getByRole('link', { name: 'Sign In' }).getAttribute('href')!;
    expect(decodeURIComponent(href)).toContain('calendar=1');
  });

  it('shows Sync Plan on a plan in This Browser, and syncs from the gate', async () => {
    const sync = vi.fn(async () => {});
    render(
      <CalendarFeedHost scope={null} gate={{ kind: 'sync', ready: true, sync }}>
        <Row />
      </CalendarFeedHost>,
    );
    const row = screen.getByRole('button', { name: 'Subscribe to Calendar' });
    expect(row.getAttribute('data-badge')).toBe('Sync Plan');
    fireEvent.click(row);
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Sync Plan' }));
    });
    expect(sync).toHaveBeenCalledOnce();
  });
});
