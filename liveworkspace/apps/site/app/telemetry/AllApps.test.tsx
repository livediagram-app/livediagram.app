// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildTelemetrySummary,
  TELEMETRY_SENDERS,
  type TelemetryDailyRow,
  type TelemetryWindowKey,
} from '@liveworkspace/telemetry';
import { AllApps } from './AllApps';

// All apps' Apps Compared (liveworkspace/docs/specs/008-telemetry/telemetry.md "Apps Compared"): the events chart with
// a line per app and the Total, the visitors and accounts for every app or one, the tables beside the charts, the
// window from the page, and the empty states.
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const NOW = Date.UTC(2026, 10, 10, 15);
const DAY = 86_400_000;
const iso = (ts: number) => new Date(ts).toISOString().slice(0, 10);
const row = (
  daysBack: number,
  app: TelemetryDailyRow['app'],
  category: string,
  action: string,
  type: string | null,
  count: number,
): TelemetryDailyRow => ({ day: iso(NOW - daysBack * DAY), app, category, action, type, count });

const busy = buildTelemetrySummary(NOW, 'all', TELEMETRY_SENDERS, [
  row(0, 'livediagram.app', 'Participant', 'Created', null, 10),
  row(0, 'livediagram.app', 'Participant', 'Returned', 'Anonymous', 30),
  row(0, 'livediagram.app', 'Session', 'SignedUp', null, 3),
  row(0, 'liveplanner.app', 'Participant', 'Created', null, 4),
  row(0, 'liveplanner.app', 'Session', 'SignedUp', null, 1),
  row(1, 'livediagram.app', 'Element', 'Added', 'Square', 50),
  row(0, 'liveworkspace.app', 'Explorer', 'Opened', null, 2),
]);
const quiet = buildTelemetrySummary(NOW, 'all', TELEMETRY_SENDERS, []);

let root: Root | null = null;
let host: HTMLElement | null = null;
const picked = vi.fn();
const selected = vi.fn();

beforeEach(() => {
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  picked.mockReset();
  selected.mockReset();
});

afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

function show(summary = busy, active: TelemetryWindowKey = 'today') {
  act(() =>
    root!.render(
      <AllApps summary={summary} onPickApp={picked} active={active} onSelect={selected} />,
    ),
  );
}
const text = () => host!.textContent ?? '';
const button = (name: string) =>
  [...host!.querySelectorAll<HTMLButtonElement>('button')].find(
    (b) => b.getAttribute('aria-label') === name || b.textContent?.trim() === name,
  );
// The visible table whose caption starts with `caption`.
const table = (caption: string) =>
  [...host!.querySelectorAll('table')].find((t) =>
    t.querySelector('caption')?.textContent?.startsWith(caption),
  );
const rowOf = (t: HTMLTableElement | undefined, name: string) =>
  [...(t?.querySelectorAll('tr') ?? [])].find((tr) =>
    tr.querySelector('th')?.textContent?.includes(name),
  );

describe('Apps Compared', () => {
  it('replaces By app with the comparison, under the window', () => {
    show();
    expect(text()).toContain('Apps Compared');
    expect(text()).not.toContain('By app');
    expect(text()).toContain('Events by App');
    expect(text()).toContain('Visitors and Accounts');
    expect(text()).toContain('Busiest Events');
  });

  it("lists each app's events, the platform's own, and the total", () => {
    show();
    const events = table('Events each app sent');
    expect(rowOf(events, 'livediagram.app')?.textContent).toContain('43');
    expect(rowOf(events, 'liveworkspace.app')?.textContent).toContain('2');
    expect(rowOf(events, 'Total')?.textContent).toContain('50');
  });

  it("opens an app's dashboard from its row", () => {
    show();
    act(() => button("Open liveplanner.app's dashboard")!.click());
    expect(picked).toHaveBeenCalledWith('liveplanner.app');
  });

  it('hides and shows a line from its legend entry', () => {
    show();
    const total = [
      ...host!.querySelectorAll<HTMLButtonElement>('[aria-label="Lines"] button'),
    ].find((b) => b.textContent === 'Total')!;
    const daily = () => table('Events per day by app')!;
    expect(daily().querySelector('thead')!.textContent).toContain('Total');
    act(() => total.click());
    expect(total.getAttribute('aria-pressed')).toBe('false');
    expect(daily().querySelector('thead')!.textContent).not.toContain('Total');
    act(() => total.click());
    expect(daily().querySelector('thead')!.textContent).toContain('Total');
  });

  it('shows every app added up, then one app, in the tiles', () => {
    show();
    const tile = (label: string) =>
      [...host!.querySelectorAll('dt')].find((dt) => dt.textContent === label)!.parentElement!
        .textContent;
    expect(tile('New Visitors')).toContain('14');
    expect(tile('Sign-Ups')).toContain('4');
    act(() =>
      [...host!.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
        .find((b) => b.textContent === 'liveplanner.app')!
        .click(),
    );
    expect(tile('New Visitors')).toContain('4');
    expect(tile('Sign-Ups')).toContain('1');
    expect(tile('Sign-Ups per 100 New')).toContain('25');
  });

  it('compares the apps on visitors and accounts, with the total', () => {
    show();
    const audience = table('Visitors and accounts by app');
    const diagram = rowOf(audience, 'livediagram.app')!.textContent;
    // 10 new, 30 returning, 75% returning, 3 sign-ups, 30 per 100 new.
    expect(diagram).toContain('75%');
    expect(diagram).toContain('30 per 100');
    expect(rowOf(audience, 'Total')!.textContent).toContain('44');
  });

  it('gives every chart a table of its days for a screen reader', () => {
    show();
    for (const caption of [
      'Events per day by app',
      'New and returning visitors per day',
      'Sign-ups and sign-ins per day',
    ])
      expect(table(caption)!.querySelectorAll('tbody tr')).toHaveLength(30);
  });

  it('says so when nothing has arrived', () => {
    show(quiet);
    expect(text()).toContain('No Events Yet');
    expect(text()).toContain('No Visitors Yet');
  });

  it('follows the window it is given and hands a pick back to the page', () => {
    show(busy, 'last7');
    expect(text()).toContain('Each app in the last 7 days, against the 7 days before');
    act(() =>
      [...host!.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')]
        .find((b) => b.textContent?.includes('Last 30 days'))!
        .click(),
    );
    expect(selected).toHaveBeenCalledWith('last30');
  });
});
