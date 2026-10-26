// A pass's limits (liveworkspace/docs/specs/005-drive/drive.md "Cadence", "Limits and cost"): a burst of Drive-side changes is
// applied in batches of DRIVE_PASS_MAX_INBOUND over several alarms, each change exactly once, and no alarm makes more
// subrequests than its budget, whichever half spends it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DRIVE_PASS_MAX_INBOUND, DRIVE_PASS_SUBREQUEST_BUDGET } from '@liveworkspace/drive';
import { GOOGLE_USER, harness, PERSON, type Harness } from '../test-support';

// What a meter doesn't count: an access-token refresh (once an hour) per alarm.
const UNCOUNTED = 1;

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => vi.restoreAllMocks());

async function mirrored(h: Harness, items: number) {
  for (let i = 0; i < items; i++) h.index.addItem({ name: `Item ${i}` });
  const folder = h.index.addFolder('Moved here');
  expect(await h.connect()).toEqual({ outcome: 'connected' });
  for (let i = 0; i < 100 && h.alarm.at !== null && h.alarm.at <= h.clock.now() + 1000; i++)
    await h.runDue();
  expect(h.files().filter((f) => f.appProperties.lwItemId)).toHaveLength(items);
  h.index.writes = [];
  h.resetAlarmStats();
  h.clock.advance(60_000);
  return folder;
}

function expectWithinBudget(h: Harness, budget: number) {
  for (const meter of h.meters) expect(meter.peak).toBeLessThanOrEqual(budget);
  expect(h.alarmStats().peak).toBeLessThanOrEqual(budget + UNCOUNTED);
}

describe('a burst of Drive-side changes', () => {
  it('applies 500 moves over several alarms, each exactly once, inside the budget', async () => {
    const h = harness();
    const folder = await mirrored(h, 500);
    const target = h.folderFileOf(folder.id)!.id;
    const ids = [...h.index.items.keys()];
    for (const id of ids) h.google.userMove(h.fileOf(id)!.id, target);

    await h.pass();
    const moves = h.index.writes.filter((w) => w.startsWith('move-item '));
    expect(moves).toHaveLength(500);
    expect(new Set(moves).size).toBe(500);
    expect(h.index.writes).toHaveLength(500);
    for (const id of ids) expect(h.index.items.get(id)!.folderId).toBe(folder.id);
    expect(h.alarmStats().alarms).toBeGreaterThanOrEqual(Math.ceil(500 / DRIVE_PASS_MAX_INBOUND));
    expectWithinBudget(h, DRIVE_PASS_SUBREQUEST_BUDGET);
    // Done: nothing more to apply, nothing written back, and the page token caught up.
    expect(h.mirror.connectionSummary(PERSON)).toMatchObject({ syncing: false, status: 'ok' });
    h.index.writes = [];
    const uploads = h.google.requests.length;
    await h.pass();
    expect(h.index.writes).toEqual([]);
    expect(h.google.requests.slice(uploads).filter((r) => r.method !== 'GET')).toEqual([]);
    for (const id of ids) expect(h.fileOf(id)!.parents).toEqual([target]);
  });

  it('stops at a small budget in either half and finishes over more alarms, never past it', async () => {
    const budget = 60;
    const h = harness({ budget });
    // The first mirror: outbound alone, against the budget.
    const folder = await mirrored(h, 120);
    expectWithinBudget(h, budget);
    const target = h.folderFileOf(folder.id)!.id;
    const ids = [...h.index.items.keys()];
    for (const id of ids) {
      h.google.userMove(h.fileOf(id)!.id, target);
      h.google.userRename(h.fileOf(id)!.id, `Renamed ${id}.livediagram`);
    }
    for (let i = 0; i < 20 && h.alarm.at !== null; i++) {
      h.alarm.at = Math.min(h.alarm.at, h.clock.now());
      await h.runDue();
    }
    expect(h.index.writes.filter((w) => w.startsWith('move-item '))).toHaveLength(120);
    expect(h.index.writes.filter((w) => w.startsWith('rename-item '))).toHaveLength(120);
    for (const id of ids) {
      expect(h.index.items.get(id)).toMatchObject({ folderId: folder.id, name: `Renamed ${id}` });
    }
    expect(h.alarmStats().alarms).toBeGreaterThan(3);
    expectWithinBudget(h, budget);
  });
});

describe('the meter', () => {
  it('charges every request, and no meter in a whole first mirror passes the default budget', async () => {
    const h = harness();
    await mirrored(h, 100);
    expect(h.meters.length).toBeGreaterThan(0);
    expect(Math.max(...h.meters.map((m) => m.peak))).toBeGreaterThan(0);
    expectWithinBudget(h, DRIVE_PASS_SUBREQUEST_BUDGET);
    expect(h.google.appFiles(GOOGLE_USER).length).toBeGreaterThan(100);
  });
});
