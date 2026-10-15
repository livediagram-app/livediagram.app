import { describe, expect, it } from 'vitest';
import {
  DASHBOARD_CHECKLIST_ITEMS_MAX,
  calendarDayAfter,
  daysUntil,
  isCalendarDay,
  newDashboardCard,
  readDashboardCard,
  safeLinkUrl,
} from './dashboard-cards';

// docs/specs/026-plan/plan-tabs.md "Cards".
describe('a link’s address', () => {
  it('opens only http(s) and mailto, adding https to a bare host', () => {
    expect(safeLinkUrl('example.com/docs')).toBe('https://example.com/docs');
    expect(safeLinkUrl('http://example.com')).toBe('http://example.com/');
    expect(safeLinkUrl('mailto:team@example.com')).toBe('mailto:team@example.com');
    expect(safeLinkUrl('javascript:alert(1)')).toBeNull();
    expect(safeLinkUrl('data:text/html,hi')).toBeNull();
    expect(safeLinkUrl('not a url')).toBeNull();
    expect(safeLinkUrl('')).toBeNull();
  });
});

describe('reading a stored card', () => {
  it('reads a Status, falling back to On Track for an unknown state', () => {
    expect(readDashboardCard({ type: 'status', state: 'at-risk', text: 'Late', at: 5 })).toEqual({
      type: 'status',
      state: 'at-risk',
      text: 'Late',
      at: 5,
    });
    expect(readDashboardCard({ type: 'status', state: 'sunny' })).toMatchObject({
      state: 'on-track',
      at: 0,
    });
  });

  it('keeps a Checklist within its limits, dropping items without an id', () => {
    const items = Array.from({ length: 40 }, (_, i) => ({ id: `i${i}`, text: 'x', done: i === 0 }));
    const c = readDashboardCard({
      type: 'checklist',
      title: 'Launch',
      items: [{ text: 'no id' }, ...items],
    });
    expect(c?.type === 'checklist' && c.items.length).toBe(DASHBOARD_CHECKLIST_ITEMS_MAX - 1);
    expect(c?.type === 'checklist' && c.items[0]).toEqual({ id: 'i0', text: 'x', done: true });
  });

  it('drops a Key Date that is not a real day', () => {
    expect(
      readDashboardCard({ type: 'key-date', title: 'Launch', date: '2026-02-30' }),
    ).toMatchObject({
      date: '',
    });
    expect(
      readDashboardCard({ type: 'key-date', title: 'Launch', date: '2026-03-01' }),
    ).toMatchObject({
      date: '2026-03-01',
    });
  });

  it('drops a link it cannot open safely, keeping links to tabs', () => {
    const c = readDashboardCard({
      type: 'links',
      title: 'Links',
      links: [
        { id: 'a', label: 'Repo', url: 'github.com/x' },
        { id: 'b', label: 'Bad', url: 'javascript:alert(1)' },
        { id: 'c', label: 'Board', tabId: 't1' },
      ],
    });
    expect(c?.type === 'links' && c.links).toEqual([
      { id: 'a', label: 'Repo', url: 'https://github.com/x' },
      { id: 'c', label: 'Board', tabId: 't1' },
    ]);
  });

  it('is not a card for anything else', () => {
    expect(readDashboardCard({ type: 'note' })).toBeUndefined();
  });
});

describe('dates', () => {
  it('counts whole days to a date, negative once it has passed', () => {
    expect(daysUntil('2026-10-25', '2026-10-11')).toBe(14);
    expect(daysUntil('2026-10-11', '2026-10-11')).toBe(0);
    expect(daysUntil('2026-10-01', '2026-10-11')).toBe(-10);
    expect(daysUntil('', '2026-10-11')).toBeNull();
  });

  it('starts a Key Date two weeks out', () => {
    const now = new Date(2026, 9, 11);
    expect(calendarDayAfter(now, 14)).toBe('2026-10-25');
    expect(newDashboardCard('key-date', now)).toMatchObject({ date: '2026-10-25' });
    expect(isCalendarDay('2026-10-25')).toBe(true);
  });
});

describe('a figure from a Sheet', () => {
  it('reads its sheet and cells by id, dropping anything malformed', () => {
    expect(
      readDashboardCard({
        type: 'sheet-metric',
        metric: 'figure',
        sheetId: 'sheetAAAA',
        cell: { r: 'r0001', c: 'c0002' },
        target: { r: 'bad id!', c: 'c0002' },
      }),
    ).toEqual({
      type: 'sheet-metric',
      metric: 'figure',
      sheetId: 'sheetAAAA',
      cell: { r: 'r0001', c: 'c0002' },
    });
    expect(
      readDashboardCard({
        type: 'sheet-metric',
        metric: 'summary',
        sheetId: 'x',
        col: 'c0001',
        stat: 'max',
      }),
    ).toEqual({
      type: 'sheet-metric',
      metric: 'summary',
      sheetId: '',
      col: 'c0001',
      stat: 'max',
    });
    expect(readDashboardCard({ type: 'sheet-metric', metric: 'pie' })).toBeUndefined();
  });
});

// A figure from a form (docs/specs/026-plan/plan-tabs.md "Form Metrics").
describe('readDashboardCard form-metric', () => {
  it('keeps a known figure and its form, and an unset form as empty', () => {
    expect(
      readDashboardCard({ type: 'form-metric', metric: 'responses', formTabId: 'tab-1' }),
    ).toEqual({
      type: 'form-metric',
      metric: 'responses',
      formTabId: 'tab-1',
    });
    expect(readDashboardCard({ type: 'form-metric', metric: 'link', formTabId: 7 })).toEqual({
      type: 'form-metric',
      metric: 'link',
      formTabId: '',
    });
    expect(readDashboardCard({ type: 'form-metric', metric: 'votes' })).toBeUndefined();
  });
});
