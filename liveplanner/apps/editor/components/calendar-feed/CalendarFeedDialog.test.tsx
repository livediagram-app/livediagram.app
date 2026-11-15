// @vitest-environment jsdom
// docs/specs/026-plan/calendar-feed.md "Subscribe to Calendar": the person's own feed read fresh, in its three states
// (Off, Just made, On); Make Calendar Link with the options chosen, the link shown once to copy or hand to a
// calendar, an option change that saves at once and keeps the link (and goes back when the save fails), Reset Link
// and Turn Off behind their confirms, the privacy note in every state, and the read and write failures.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CalendarFeedResponse } from '@liveplanner/api-schema';
import { CalendarFeedDialog } from './CalendarFeedDialog';
import { CalendarFeedHost } from './CalendarFeedHost';
import { CalendarFeedMenuRow } from './CalendarFeedMenuRow';
import { boardLabels } from './CalendarFeedOptions';

const client = vi.hoisted(() => ({
  readCalendarFeed: vi.fn(),
  issueCalendarFeed: vi.fn(),
  changeCalendarFeed: vi.fn(),
  turnOffCalendarFeed: vi.fn(),
}));
vi.mock('./calendar-feed-client', () => client);
const track = vi.hoisted(() => vi.fn());
vi.mock('@/lib/telemetry', () => ({ track }));

const SCOPE = { ownerId: 'user_1', projectId: 'p1' };
const BOARDS = [
  { id: 'b1', title: 'Roadmap', tabName: 'Plan' },
  { id: 'b2', title: 'Bugs', tabName: 'Triage' },
];
const MADE = Date.UTC(2026, 10, 3);
const FEED = { boardId: null, mine: false, includeDone: false, createdAt: MADE };
const PATH = '/api/calendar/p1/lpf_abcdefghijklmnopqrstuvwxyz0123456789ABCDEFG.ics';
const writeText = vi.fn();

const answer = (r: CalendarFeedResponse) => client.readCalendarFeed.mockResolvedValue(r);
const open = async (r: CalendarFeedResponse, onClose = vi.fn()) => {
  answer(r);
  render(<CalendarFeedDialog scope={SCOPE} onClose={onClose} />);
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
    await open({ feed: null, boards: BOARDS });
    expect(stateOf()).toBe('off');
    expect(screen.getByText(/Anyone with this link can see the titles and dates/)).toBeTruthy();
    const board = screen.getByLabelText('Board') as HTMLSelectElement;
    expect([...board.options].map((o) => o.textContent)).toEqual(['All Boards', 'Roadmap', 'Bugs']);
    fireEvent.change(board, { target: { value: 'b2' } });
    fireEvent.click(screen.getByRole('switch', { name: /Only My Cards/ }));
    // Choosing in Off saves nothing yet.
    expect(client.changeCalendarFeed).not.toHaveBeenCalled();

    client.issueCalendarFeed.mockResolvedValue({
      feed: { boardId: 'b2', mine: true, includeDone: false, createdAt: MADE },
      path: PATH,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Make Calendar Link' }));
    const field = (await screen.findByLabelText('Calendar link')) as HTMLInputElement;
    expect(client.issueCalendarFeed).toHaveBeenCalledWith(SCOPE, {
      boardId: 'b2',
      mine: true,
      includeDone: false,
    });
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
    await open({ feed: null, boards: BOARDS });
    client.issueCalendarFeed.mockResolvedValue({ feed: FEED, path: PATH });
    fireEvent.click(screen.getByRole('button', { name: 'Make Calendar Link' }));
    const field = (await screen.findByLabelText('Calendar link')) as HTMLInputElement;
    writeText.mockRejectedValue(new Error('denied'));
    fireEvent.click(screen.getByRole('button', { name: 'Copy Link' }));
    await waitFor(() => expect(document.activeElement).toBe(field));
    expect(track).not.toHaveBeenCalledWith('Plan', 'Copied', 'CalendarFeed');
  });

  it('says so when the link cannot be made, and stays Off', async () => {
    await open({ feed: null, boards: [] });
    client.issueCalendarFeed.mockRejectedValue(new Error('500'));
    fireEvent.click(screen.getByRole('button', { name: 'Make Calendar Link' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Couldn’t save. Try again.');
    expect(stateOf()).toBe('off');
  });

  it('closes from Done once the link is shown, and from the header', async () => {
    const onClose = await open({ feed: null, boards: [] });
    client.issueCalendarFeed.mockResolvedValue({ feed: FEED, path: PATH });
    fireEvent.click(screen.getByRole('button', { name: 'Make Calendar Link' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('On', () => {
  it('says when the link was made, never shows it, and reads the options it was made with', async () => {
    await open({ feed: { ...FEED, boardId: 'b1', includeDone: true }, boards: BOARDS });
    expect(stateOf()).toBe('on');
    expect(screen.getByText(/^Your calendar link is on\. Made .*2026\.$/)).toBeTruthy();
    expect(screen.queryByLabelText('Calendar link')).toBeNull();
    expect((screen.getByLabelText('Board') as HTMLSelectElement).value).toBe('b1');
    expect(
      screen.getByRole('switch', { name: /Include Done Cards/ }).getAttribute('aria-checked'),
    ).toBe('true');
    expect(screen.getByText(/Anyone with this link can see the titles and dates/)).toBeTruthy();
  });

  it('saves a changed option at once, keeping the link', async () => {
    await open({ feed: FEED, boards: BOARDS });
    client.changeCalendarFeed.mockResolvedValue({ feed: { ...FEED, mine: true } });
    fireEvent.click(screen.getByRole('switch', { name: /Only My Cards/ }));
    await waitFor(() =>
      expect(client.changeCalendarFeed).toHaveBeenCalledWith(SCOPE, {
        boardId: null,
        mine: true,
        includeDone: false,
      }),
    );
    expect(track).toHaveBeenCalledWith('Plan', 'Changed', 'CalendarFeedOptions');
    expect(client.issueCalendarFeed).not.toHaveBeenCalled();
    expect(stateOf()).toBe('on');
  });

  it('puts an option back when its save fails, and says so', async () => {
    await open({ feed: FEED, boards: BOARDS });
    client.changeCalendarFeed.mockRejectedValue(new Error('500'));
    const mine = screen.getByRole('switch', { name: /Only My Cards/ });
    fireEvent.click(mine);
    expect((await screen.findByRole('alert')).textContent).toBe('Couldn’t save. Try again.');
    expect(mine.getAttribute('aria-checked')).toBe('false');
  });

  it('shows a board that went for what it is, until another is picked', async () => {
    await open({ feed: { ...FEED, boardId: 'gone' }, boards: BOARDS });
    const board = screen.getByLabelText('Board') as HTMLSelectElement;
    expect(board.value).toBe('gone');
    expect(board.selectedOptions[0]!.textContent).toBe('Removed Board');
    client.changeCalendarFeed.mockResolvedValue({ feed: FEED });
    fireEvent.change(board, { target: { value: '' } });
    await waitFor(() =>
      expect(client.changeCalendarFeed).toHaveBeenCalledWith(SCOPE, {
        boardId: null,
        mine: false,
        includeDone: false,
      }),
    );
  });

  it('resets the link behind its confirm, and shows the new one', async () => {
    await open({ feed: FEED, boards: BOARDS });
    fireEvent.click(screen.getByRole('button', { name: 'Reset Link' }));
    expect(screen.getByText(/stops working at once/)).toBeTruthy();
    client.issueCalendarFeed.mockResolvedValue({
      feed: { ...FEED, createdAt: MADE + 1 },
      path: PATH,
    });
    confirmIn('Reset Link');
    await screen.findByLabelText('Calendar link');
    expect(client.issueCalendarFeed).toHaveBeenCalledWith(SCOPE, {
      boardId: null,
      mine: false,
      includeDone: false,
    });
    expect(track).toHaveBeenCalledWith('Plan', 'Changed', 'CalendarFeedLink');
    expect(stateOf()).toBe('made');
  });

  it('cancels a confirm without a change', async () => {
    await open({ feed: FEED, boards: BOARDS });
    fireEvent.click(screen.getByRole('button', { name: 'Turn Off' }));
    fireEvent.click(
      within(document.querySelector('[data-confirm-popover]') as HTMLElement).getByRole('button', {
        name: 'Cancel',
      }),
    );
    expect(document.querySelector('[data-confirm-popover]')).toBeNull();
    expect(client.turnOffCalendarFeed).not.toHaveBeenCalled();
  });

  it('turns off behind its confirm, back to Off with Make Calendar Link focused', async () => {
    await open({ feed: FEED, boards: BOARDS });
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
    await open({ feed: FEED, boards: BOARDS });
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
    render(<CalendarFeedDialog scope={SCOPE} onClose={vi.fn()} />);
    expect(stateOf()).toBe('loading');
    expect((await screen.findByRole('alert')).textContent).toBe(
      'Couldn’t load your calendar link.',
    );
    expect(stateOf()).toBe('error');
    answer({ feed: null, boards: [] });
    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));
    await screen.findByText('What It Shows');
    expect(stateOf()).toBe('off');
  });
});

describe('board labels', () => {
  it("name a board by its title, with its tab's name when two share a title, or the tab's name for none", () => {
    expect(
      boardLabels([
        { id: 'a', title: 'Kanban', tabName: 'One' },
        { id: 'b', title: 'Kanban', tabName: 'Two' },
        { id: 'c', title: '', tabName: 'Three' },
        { id: 'd', title: 'Bugs', tabName: 'Four' },
      ]),
    ).toEqual(
      new Map([
        ['a', 'Kanban (One)'],
        ['b', 'Kanban (Two)'],
        ['c', 'Three'],
        ['d', 'Bugs'],
      ]),
    );
  });
});

describe('the door', () => {
  it('draws no row for someone who may not have a feed', () => {
    render(
      <CalendarFeedHost scope={null}>
        <CalendarFeedMenuRow onClose={vi.fn()} />
      </CalendarFeedHost>,
    );
    expect(screen.queryByRole('menuitem')).toBeNull();
    expect(screen.queryByText('Subscribe to Calendar…')).toBeNull();
  });

  it('opens the dialog from the tab menu row, closing the menu', async () => {
    answer({ feed: null, boards: [] });
    const onClose = vi.fn();
    render(
      <CalendarFeedHost scope={SCOPE}>
        <CalendarFeedMenuRow onClose={onClose} />
      </CalendarFeedHost>,
    );
    fireEvent.click(screen.getByText('Subscribe to Calendar…'));
    expect(onClose).toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith('UI', 'Opened', 'CalendarFeed');
    expect(await screen.findByText('Subscribe to Calendar')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    await waitFor(() => expect(screen.queryByText('What It Shows')).toBeNull());
  });
});
