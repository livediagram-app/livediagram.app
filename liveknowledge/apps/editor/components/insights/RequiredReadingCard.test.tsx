// @vitest-environment jsdom
// docs/specs/030-knowledgebase/required-reading.md "Where it shows": Insights' Required Reading card lists each
// page with its bar and counts, in the order the api sends (least read first), a row opening its page; empty, it says
// how a page becomes Required Reading. Counts only: nothing here names a person.
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RequiredReadingCard } from './RequiredReadingCard';

afterEach(cleanup);

describe('RequiredReadingCard', () => {
  it('lists each page with its bar and counts, and opens one', () => {
    const open = vi.fn();
    render(
      <RequiredReadingCard
        pages={[
          { tab: 'a', title: 'Expenses', audience: 'everyone', done: 3, total: 12 },
          { tab: 'b', title: '', audience: 'people', done: 2, total: 2 },
        ]}
        onOpenPage={open}
      />,
    );
    const rows = screen.getAllByRole('listitem');
    expect(rows.map((r) => r.dataset.requiredReading)).toEqual(['a', 'b']);
    expect(within(rows[0]!).getByText('3 of 12')).toBeTruthy();
    expect(within(rows[0]!).getByText('Everyone')).toBeTruthy();
    expect(within(rows[1]!).getByText('Untitled Page')).toBeTruthy();
    expect(within(rows[1]!).getByText('2 People')).toBeTruthy();
    const bar = within(rows[0]!).getByRole('progressbar');
    expect(bar.getAttribute('aria-valuetext')).toBe('3 of 12 have read it');
    fireEvent.click(within(rows[1]!).getByRole('button'));
    expect(open).toHaveBeenCalledWith('b');
  });

  it('says how a page becomes Required Reading when none is', () => {
    render(<RequiredReadingCard pages={[]} onOpenPage={vi.fn()} />);
    expect(screen.getByText('No Required Reading')).toBeTruthy();
    expect(
      screen.getByText('An Editor marks a page Required Reading from its Page Info.'),
    ).toBeTruthy();
  });
});
