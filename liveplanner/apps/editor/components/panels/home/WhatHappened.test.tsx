// @vitest-environment jsdom

import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// What Happened (docs/specs/013-workspace/explorer-home.md): one person's actions are links that
// open the project; several people collapse into a summary that expands; no link of its own
// and no filter controls.

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/telemetry', () => ({ track }));

import { WhatHappened } from './WhatHappened';
import { fixtureAction, fixtureGroup, fixturePerson } from './home-test-utils';

// A fixed afternoon, so every action is earlier today and Today is that day.
const NOW = new Date(2026, 7, 30, 15, 0).getTime();
const today = (h: number, m = 0) => new Date(2026, 7, 30, h, m).getTime();
const todayKey = () => '2026-08-30';

const solo = fixtureGroup({
  id: 'd2:day',
  day: todayKey(),
  projectId: 'd2',
  name: 'Onboarding',
  via: 'own',
  teamName: null,
  folderName: 'Guides',
  people: [fixturePerson('sam', 'Sam')],
  actions: [
    fixtureAction('a2', 'commented', 'sam', today(11), 'Looks good'),
    fixtureAction('a1', 'edited', 'sam', today(9)),
  ],
});
const busy = fixtureGroup({
  id: 'd1:day',
  day: todayKey(),
  people: ['Priya', 'Sam', 'Lee'].map((n) => fixturePerson(n.toLowerCase(), n)),
  actions: [
    fixtureAction('b3', 'assigned_you', 'priya', today(14, 5), 'Review API'),
    fixtureAction('b2', 'edited', 'sam', today(12)),
    fixtureAction('b1', 'commented', 'lee', today(10)),
  ],
});

function renderIt(groups = [busy, solo], lastSeenAt?: number) {
  render(<WhatHappened groups={groups} lastSeenAt={lastSeenAt} loading={false} />);
}

beforeEach(() => {
  track.mockReset();
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
});
afterEach(() => vi.useRealTimers());

describe('WhatHappened', () => {
  it('shows one person’s actions as links naming who, what, which project and where', () => {
    renderIt();
    const comment = screen.getByRole('link', { name: /Sam commented on Onboarding/ });
    expect(comment.getAttribute('href')).toBe('/project/d2');
    expect(within(comment).getByText('“Looks good”')).toBeTruthy();
    expect(comment.textContent).toContain('My Work › Guides · ');
    expect(screen.getByRole('link', { name: /Sam edited Onboarding/ })).toBeTruthy();
    fireEvent.click(comment);
    expect(track).toHaveBeenCalledWith('Home', 'Selected', 'WhatHappened');
  });

  it('collapses several people into one summary that expands to every action', () => {
    renderIt();
    const summary = screen.getByRole('button', {
      name: /Priya, Sam and Lee assigned you an action, edited and commented in Payments architecture/,
    });
    expect(summary.getAttribute('aria-expanded')).toBe('false');
    expect(summary.textContent).toContain('Platform team · 3 updates · ');
    const list = document.getElementById(summary.getAttribute('aria-controls')!)!;
    expect(list.hidden).toBe(true);

    fireEvent.click(summary);
    expect(summary.getAttribute('aria-expanded')).toBe('true');
    expect(list.hidden).toBe(false);
    const rows = within(list).getAllByRole('link');
    expect(rows.map((r) => r.getAttribute('aria-label')?.split(',')[0])).toEqual([
      'Priya assigned you an action',
      'Sam edited',
      'Lee commented',
    ]);
    expect(track).toHaveBeenCalledWith('Home', 'Opened', 'Group');

    fireEvent.click(summary);
    expect(summary.getAttribute('aria-expanded')).toBe('false');
    expect(track).toHaveBeenCalledTimes(1);
  });

  it('marks what is newer than the last look as New, in words', () => {
    renderIt([busy, solo], today(10, 30));
    expect(screen.getByRole('button', { name: /in Payments architecture\s*New/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Sam commented on Onboarding.*New/ })).toBeTruthy();
    expect(screen.getByRole('link', { name: /Sam edited Onboarding/ }).textContent).not.toContain(
      'New',
    );
  });

  it('marks nothing for someone who never looked', () => {
    renderIt();
    expect(screen.queryByText('New')).toBeNull();
  });

  it('heads entries by day', () => {
    renderIt();
    expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy();
  });

  it('carries no See Timeline link: the Timeline is gone', () => {
    renderIt();
    expect(screen.queryByRole('link', { name: 'See Timeline' })).toBeNull();
  });

  it('leaves the section out when nothing happened', () => {
    const { container } = render(
      <WhatHappened groups={[]} loading={false} lastSeenAt={undefined} />,
    );
    expect(container.innerHTML).toBe('');
  });

  it('holds its heading and skeleton while it loads, without the link', () => {
    render(<WhatHappened groups={[]} loading lastSeenAt={undefined} />);
    expect(screen.getByRole('heading', { level: 2, name: 'What Happened' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'See Timeline' })).toBeNull();
  });

  it('offers no filter controls', () => {
    renderIt();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
