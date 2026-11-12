// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AttendanceVisit, TabAttendanceResponse } from '@livehuddle/api-schema';
import { bindWorkbench } from '@/lib/workbench-bindings';
import { TabAttendanceDialog } from './TabAttendanceDialog';

// A tab's Attendance dialog (docs/specs/012-collaboration/tab-attendance.md "Where it shows"): the visits by day with
// their badges and lengths, and its loading, empty and failed states.

// The clock pinned to midday, so every visit below started "Today".
const now = new Date(2026, 10, 11, 12, 0).getTime();
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(now);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});
const visit = (over: Partial<AttendanceVisit>): AttendanceVisit => ({
  id: 1,
  name: 'Ada Lovelace',
  color: '#0ea5e9',
  guest: false,
  self: false,
  joinedAt: now - 45 * 60_000,
  leftAt: now - 60_000,
  ...over,
});
const answer = (visits: AttendanceVisit[]): TabAttendanceResponse => ({
  visits,
  retentionDays: 90,
  perTabMax: 500,
});

function open(load: () => Promise<TabAttendanceResponse>, onClose = vi.fn()) {
  bindWorkbench();
  render(<TabAttendanceDialog tabName="Team Pod" load={load} onClose={onClose} />);
  return onClose;
}

describe('the Attendance dialog', () => {
  it('lists who was in the tab, with their badges and time spent', async () => {
    open(async () =>
      answer([
        visit({
          id: 2,
          name: 'Bo',
          guest: true,
          self: true,
          joinedAt: now - 5 * 60_000,
          leftAt: null,
        }),
        visit({ id: 1 }),
      ]),
    );
    expect(screen.getByRole('dialog', { name: 'Attendance' })).toBeTruthy();
    expect(screen.getByText('Team Pod · Last 90 days')).toBeTruthy();
    expect(screen.getByLabelText('Loading attendance')).toBeTruthy();
    const today = await screen.findByRole('region', { name: 'Today' });
    const rows = within(today).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(within(rows[0]!).getByText('You')).toBeTruthy();
    expect(within(rows[0]!).getByText('Guest')).toBeTruthy();
    expect(within(rows[0]!).getByText('Here Now')).toBeTruthy();
    expect(within(rows[1]!).queryByText('Here Now')).toBeNull();
    expect(within(rows[1]!).getByText('44 min')).toBeTruthy();
    expect(within(rows[1]!).getByText('44 minutes')).toBeTruthy();
  });

  it('says so when nobody has been in the tab', async () => {
    open(async () => answer([]));
    expect(await screen.findByText('Nobody has been in this tab yet.')).toBeTruthy();
    expect(screen.getByText('Visits show here for 90 days.')).toBeTruthy();
  });

  it('offers Try Again when the read fails, and reads again', async () => {
    const load = vi
      .fn<() => Promise<TabAttendanceResponse>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(answer([visit({ name: 'Cy' })]));
    open(load);
    fireEvent.click(await screen.findByRole('button', { name: 'Try Again' }));
    expect(await screen.findByText('Cy')).toBeTruthy();
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('closes from its close button', async () => {
    const onClose = open(async () => answer([]));
    await waitFor(() => screen.getByText('Nobody has been in this tab yet.'));
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(onClose).toHaveBeenCalled();
  });
});
