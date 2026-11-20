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
// The Detail tabs' code loads on its own; read here first, each is already in hand when its tab opens.
import './_all/EventsByApp';
import './_all/ForumChecks';
import './_all/ProjectKits';
import './_all/VisitorsAndAccounts';

// All Apps (liveworkspace/docs/specs/008-telemetry/telemetry.md "The dashboard", All Apps; "Apps Compared"): the
// Dashboard tab's cards, then a Detail tab each for the events chart with a line per app and the Total, the visitors
// and accounts for every app or one, Project Kits, Forum Checks and the busiest events; the window from the page,
// and the empty states.
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
  // The tab row measures itself and the sticky timeframe bar watches the panel scroll away.
  const Observer = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  vi.stubGlobal('ResizeObserver', Observer);
  vi.stubGlobal('IntersectionObserver', Observer);
  Element.prototype.scrollIntoView = vi.fn();
  // The Forum Checks card reads the Community service: unreachable here, which it shows as unavailable.
  vi.stubGlobal('fetch', () => Promise.reject(new Error('offline')));
  host = document.createElement('div');
  document.body.append(host);
  root = createRoot(host);
  picked.mockReset();
  selected.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  act(() => root?.unmount());
  host?.remove();
  root = null;
  host = null;
});

const tab = (name: string) =>
  [...host!.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find(
    (t) => t.textContent === name,
  )!;
// Opens a tab and lets its code, which loads on its own (next/dynamic), settle.
async function open(name: string) {
  await act(async () => {
    tab(name).click();
    for (let n = 0; n < 5; n++) await new Promise((r) => setTimeout(r, 0));
  });
}
// Renders All Apps, then opens a Detail tab when one is named (the Dashboard otherwise).
async function show(summary = busy, active: TelemetryWindowKey = 'today', tabName?: string) {
  act(() =>
    root!.render(
      <AllApps summary={summary} onPickApp={picked} active={active} onSelect={selected} />,
    ),
  );
  if (tabName) await open(tabName);
}
const EVENTS = 'Events by App';
const VISITORS = 'Visitors & Accounts';
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

describe('the tabs', () => {
  it('lays All Apps out as an app is: the Dashboard, then a Detail tab an area', async () => {
    await show();
    expect([...host!.querySelectorAll('[role="tab"]')].map((t) => t.textContent)).toEqual([
      'Dashboard',
      EVENTS,
      VISITORS,
      'Project Kits',
      'Forum Checks',
      'Busiest Events',
    ]);
    expect(tab('Dashboard').getAttribute('aria-selected')).toBe('true');
    // One area at a time: the comparison's tables are not under the Dashboard.
    expect(host!.querySelector('table caption')).toBeNull();
    await open('Busiest Events');
    expect(text()).toContain('Participant · Returned · Anonymous');
  });

  it('opens on every app added up, then a card an app under its logo', async () => {
    await show();
    expect(text()).toContain('At a Glance');
    const card = (title: string) =>
      [...host!.querySelectorAll('div.rounded-2xl')].find((c) =>
        c.firstElementChild?.textContent?.startsWith(title),
      )!.textContent;
    expect(card('Events')).toContain('50');
    expect(card('New Visitors')).toContain('14');
    expect(card('Sign-Ups')).toContain('4');
    // The app is named by its logo: the wordmark, never the bare address.
    expect(card('livediagram')).toContain('43');
    expect(card('livediagram')).toContain('New Visitors10');
    expect(text()).not.toContain('livediagram.app');
  });

  it("opens an app's dashboard from its card", async () => {
    await show();
    act(() => button("Open liveplanner's dashboard")!.click());
    expect(picked).toHaveBeenCalledWith('liveplanner.app');
  });

  it('asks the Community service for Forum Checks only once its tab is opened', async () => {
    const fetched = vi.fn(() => Promise.reject(new Error('offline')));
    vi.stubGlobal('fetch', fetched);
    await show();
    expect(fetched).not.toHaveBeenCalled();
    await open('Forum Checks');
    expect(fetched).toHaveBeenCalledTimes(1);
  });
});

describe('Apps Compared', () => {
  it("lists each app's events, the platform's own, and the total", async () => {
    await show(busy, 'today', EVENTS);
    const events = table('Events each app sent');
    expect(rowOf(events, 'livediagram')?.textContent).toContain('43');
    expect(rowOf(events, 'liveworkspace')?.textContent).toContain('2');
    expect(rowOf(events, 'Total')?.textContent).toContain('50');
  });

  it("opens an app's dashboard from its row", async () => {
    await show(busy, 'today', EVENTS);
    act(() => button("Open liveplanner's dashboard")!.click());
    expect(picked).toHaveBeenCalledWith('liveplanner.app');
  });

  it('hides and shows a line from its legend entry', async () => {
    await show(busy, 'today', EVENTS);
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

  it('shows every app added up, then one app, in the tiles', async () => {
    await show(busy, 'today', VISITORS);
    const tile = (label: string) =>
      [...host!.querySelectorAll('dt')].find((dt) => dt.textContent === label)!.parentElement!
        .textContent;
    expect(tile('New Visitors')).toContain('14');
    expect(tile('Sign-Ups')).toContain('4');
    act(() =>
      [...host!.querySelectorAll<HTMLButtonElement>('[role="radio"]')]
        .find((b) => b.getAttribute('aria-label') === 'liveplanner')!
        .click(),
    );
    expect(tile('New Visitors')).toContain('4');
    expect(tile('Sign-Ups')).toContain('1');
    expect(tile('Sign-Ups per 100 New')).toContain('25');
  });

  it('compares the apps on visitors and accounts, with the total', async () => {
    await show(busy, 'today', VISITORS);
    const audience = table('Visitors and accounts by app');
    const diagram = rowOf(audience, 'livediagram')!.textContent;
    // 10 new, 30 returning, 75% returning, 3 sign-ups, 30 per 100 new.
    expect(diagram).toContain('75%');
    expect(diagram).toContain('30 per 100');
    expect(rowOf(audience, 'Total')!.textContent).toContain('44');
  });

  it('gives every chart a table of its days for a screen reader', async () => {
    await show(busy, 'today', EVENTS);
    expect(table('Events per day by app')!.querySelectorAll('tbody tr')).toHaveLength(30);
    await open(VISITORS);
    for (const caption of ['New and returning visitors per day', 'Sign-ups and sign-ins per day'])
      expect(table(caption)!.querySelectorAll('tbody tr')).toHaveLength(30);
  });

  it('says so when nothing has arrived', async () => {
    await show(quiet, 'today', EVENTS);
    expect(text()).toContain('No events yet');
    await open(VISITORS);
    expect(text()).toContain('No visitors yet');
  });

  it('follows the window it is given and hands a pick back to the page', async () => {
    await show(busy, 'last7', EVENTS);
    expect(text()).toContain('Each app in the last 7 days, against the 7 days before');
    act(() =>
      [...host!.querySelectorAll<HTMLButtonElement>('button[aria-pressed]')]
        .find((b) => b.textContent?.includes('Last 30 days'))!
        .click(),
    );
    expect(selected).toHaveBeenCalledWith('last30');
  });
});

describe('Project Kits', () => {
  const kits = buildTelemetrySummary(NOW, 'all', TELEMETRY_SENDERS, [
    row(0, 'liveworkspace.app', 'Kit', 'Started', 'SoftwareProject', 3),
    row(0, 'liveworkspace.app', 'Kit', 'Started', 'WebsiteBuild', 1),
    row(0, 'liveworkspace.app', 'Kit', 'Completed', 'SoftwareProject', 3),
    row(0, 'liveworkspace.app', 'Kit', 'Retried', 'WebsiteBuild', 2),
    row(2, 'liveworkspace.app', 'Kit', 'Removed', 'WebsiteBuild', 1),
  ]);
  const section = () => host!.querySelector('section[aria-labelledby="project-kits"]')!;

  it("shows each step's total in the window, every kit together, and the share completed", async () => {
    await show(kits, 'today', 'Project Kits');
    const tiles = [...section().querySelectorAll('dl > div')].map((d) => d.textContent);
    expect(tiles[0]).toContain('Started4');
    expect(tiles[1]).toContain('Completed3');
    expect(tiles[1]).toContain('75% of started');
    expect(tiles[2]).toContain('Retried2');
    // Removed two days back is outside today.
    expect(tiles[3]).toContain('Removed0');
    const runs = table('Project kits started and completed per day')!;
    expect(runs.querySelector('tbody tr:last-child')!.textContent).toContain('43');
  });

  it('leaves the share out with nothing started in the window', async () => {
    await show(kits, 'today', 'Project Kits');
    await show(
      buildTelemetrySummary(NOW, 'all', TELEMETRY_SENDERS, [
        row(3, 'liveworkspace.app', 'Kit', 'Removed', 'WebsiteBuild', 1),
      ]),
      'today',
      'Project Kits',
    );
    expect(section().textContent).not.toContain('of started');
    expect(section().textContent).toContain('Removed0');
  });

  it('says so when no kit has been used', async () => {
    await show(quiet, 'today', 'Project Kits');
    expect(section().textContent).toContain('No project kits yet');
  });
});
