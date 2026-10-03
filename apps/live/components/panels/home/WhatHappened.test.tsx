// @vitest-environment jsdom

import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// What happened (docs/specs/013-workspace/explorer-home.md): one person's actions are links that
// open the document; several people collapse into a summary that expands; See all activity leads
// to the feed; no filter controls.

const { track } = vi.hoisted(() => ({ track: vi.fn() }));
vi.mock('@/lib/telemetry', () => ({ track }));

import { WhatHappened } from './WhatHappened';
import { fixtureAction, fixtureGroup, fixturePerson } from './home-test-utils';

const today = (h: number, m = 0) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.getTime();
};
const todayKey = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const solo = fixtureGroup({
  id: 'd2:day',
  day: todayKey(),
  documentId: 'd2',
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

function renderIt(groups = [busy, solo], onSeeAll = vi.fn()) {
  render(
    <WhatHappened
      groups={groups}
      loading={false}
      allActivityHref="/explorer/timeline"
      onSeeAll={onSeeAll}
    />,
  );
  return onSeeAll;
}

beforeEach(() => track.mockReset());

describe('WhatHappened', () => {
  it('shows one person’s actions as links naming who, what, which document and where', () => {
    renderIt();
    const comment = screen.getByRole('link', { name: /Sam commented on Onboarding/ });
    expect(comment.getAttribute('href')).toBe('/document/d2');
    expect(within(comment).getByText('“Looks good”')).toBeTruthy();
    expect(within(comment).getByText('My documents › Guides')).toBeTruthy();
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
    expect(summary.textContent).toContain('Platform team · 3 updates');
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

  it('heads entries by day', () => {
    renderIt();
    expect(screen.getByRole('heading', { name: 'Today' })).toBeTruthy();
  });

  it('opens All activity in the app, and leaves modified clicks to the browser', () => {
    const onSeeAll = renderIt();
    const link = screen.getByRole('link', { name: 'See all activity' });
    expect(link.getAttribute('href')).toBe('/explorer/timeline');
    fireEvent.click(link);
    expect(onSeeAll).toHaveBeenCalledTimes(1);
    fireEvent.click(link, { metaKey: true });
    expect(onSeeAll).toHaveBeenCalledTimes(1);
  });

  it('says so when nothing happened, and keeps the link', () => {
    renderIt([]);
    expect(screen.getByText('Nothing from others in the last 14 days.')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'See all activity' })).toBeTruthy();
  });

  it('offers no filter controls', () => {
    renderIt();
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});
