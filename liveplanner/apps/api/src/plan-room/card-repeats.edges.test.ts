import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ITEMS_MAX, type Item, type RepeatRule } from '@liveplanner/items';
import type { RepeatSchedule } from './card-repeats';
import { createPlan, endRepeatWorld, repeatWorld, type RepeatWorld } from './test-repeat-world';

// Repeating cards when the store pushes back (docs/specs/026-plan/items.md "Repeating cards", blueprint
// item-store.md "Repeats"): a full plan, a key or a write taken since the wake read the store, a card that cannot be
// read, and one gone or ended by the time its day comes. The real worker and PlanRoom, with the store's reads and
// writes wrapped so a test can make them push back.
vi.mock('../auth/accounts', async () => (await import('./test-accounts-mock')).accountsMock);

const push = vi.hoisted(() => ({
  full: false,
  keyTaken: null as number | null,
  insertFails: 0,
  readFails: false,
  read: null as ((item: Item | null) => Item | null) | null,
}));

vi.mock('../db', async (importOriginal) => {
  const db = await importOriginal<typeof import('../db')>();
  return {
    ...db,
    getItemStoreHead: async (...a: Parameters<typeof db.getItemStoreHead>) => {
      const head = await db.getItemStoreHead(...a);
      return {
        ...head,
        ...(push.full ? { count: ITEMS_MAX } : {}),
        ...(push.keyTaken !== null ? { nextKey: push.keyTaken } : {}),
      };
    },
    insertItems: async (...a: Parameters<typeof db.insertItems>) => {
      if (push.insertFails > 0) {
        push.insertFails -= 1;
        throw new Error('UNIQUE constraint failed: items.key');
      }
      return db.insertItems(...a);
    },
    readItem: async (...a: Parameters<typeof db.readItem>) => {
      if (push.readFails) throw new Error('read failed');
      const item = await db.readItem(...a);
      return push.read ? push.read(item) : item;
    },
  };
});

const at = (iso: string) => Date.parse(iso);
const RULE: RepeatRule = { every: 'day', from: '2026-11-02', timeZone: 'Europe/London' };

let w: RepeatWorld;
let warn: ReturnType<typeof vi.fn<(...a: unknown[]) => void>>;
beforeEach(async () => {
  Object.assign(push, {
    full: false,
    keyTaken: null,
    insertFails: 0,
    readFails: false,
    read: null,
  });
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(at('2026-11-02T10:00:00Z'));
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  warn = vi.fn<(...a: unknown[]) => void>();
  vi.spyOn(console, 'warn').mockImplementation(warn);
  w = repeatWorld();
  await createPlan(w, 'A');
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  endRepeatWorld();
});

const plan = () => w.plans.get('A')!;
const schedule = () => Reflect.get(plan().room, 'repeats') as RepeatSchedule;
const wakeAt = async (iso: string) => {
  vi.setSystemTime(at(iso));
  await plan().room.alarm();
};
const copiesOf = (items: Item[], source: Item) =>
  items.filter((i) => i.id !== source.id && i.fields['title'] === source.fields['title']);
const rows = () => plan().db.prepare('SELECT * FROM item_repeats').all();
const woken = () => new Promise((r) => setTimeout(r, 0));
const warned = (what: string) => warn.mock.calls.some((c) => c[0] === what);

// A card set repeating, its rule settled on the first wake.
async function repeating(title: string, rule: RepeatRule = RULE): Promise<Item> {
  const source = await w.make('A', { title, repeat: rule });
  await plan().room.alarm();
  return source;
}

describe('a repeating card when the store pushes back', () => {
  it('settles the day without a copy in a plan at its card limit, then carries on', async () => {
    const source = await repeating('Full');
    push.full = true;
    await wakeAt('2026-11-03T00:00:00Z');
    expect(copiesOf(await w.items('A'), source)).toHaveLength(0);
    expect(warned('[repeats] items_full')).toBe(true);
    expect(rows()).toMatchObject([{ last_made: '2026-11-03' }]);
    push.full = false;
    await wakeAt('2026-11-04T00:00:00Z');
    expect(copiesOf(await w.items('A'), source)).toHaveLength(1);
  });

  it('steps past a key taken since the store was read', async () => {
    const source = await repeating('Keyed');
    push.keyTaken = source.key;
    await wakeAt('2026-11-03T00:00:00Z');
    const [copy] = copiesOf(await w.items('A'), source);
    expect(copy?.key).toBe(source.key + 1);
  });

  it('reads the store again after a refused write, and parks the card once the retries run out', async () => {
    const source = await repeating('Retried');
    push.insertFails = 1;
    await wakeAt('2026-11-03T00:00:00Z');
    expect(copiesOf(await w.items('A'), source)).toHaveLength(1);
    push.insertFails = 99;
    await wakeAt('2026-11-04T00:00:00Z');
    expect(copiesOf(await w.items('A'), source)).toHaveLength(1);
    expect(warned('[repeats] failed')).toBe(true);
    // Parked: no wake asks for it again until its card changes.
    expect(rows()).toMatchObject([{ last_made: '2026-11-03', next_at: null, dirty: 0 }]);
    expect(schedule().at).toBeNull();
    push.insertFails = 0;
    await w.send('POST', `/api/projects/A/items/${source.id}`, {
      set: { repeat: { ...RULE, every: 'weekday' } },
    });
    // Changed, it resumes: the parked day (Wednesday) comes once, then Thursday on time.
    await plan().room.alarm();
    expect(copiesOf(await w.items('A'), source)).toHaveLength(2);
    await wakeAt('2026-11-05T00:00:00Z');
    expect(copiesOf(await w.items('A'), source)).toHaveLength(3);
  });

  it('parks a changed rule whose card cannot be read', async () => {
    await w.make('A', { title: 'Unread', repeat: RULE });
    push.readFails = true;
    await plan().room.alarm();
    expect(rows()).toMatchObject([{ next_at: null, dirty: 0 }]);
    expect(warned('[repeats] failed')).toBe(true);
  });

  it('makes nothing for a card that ended or went by the time its day came', async () => {
    const ended = await repeating('Ended');
    // Its rule reads as ended by the wake (as a clock moved back would leave it): settled, nothing more asked for.
    push.read = (item) =>
      item?.id === ended.id
        ? { ...item, fields: { ...item.fields, repeat: { ...RULE, until: '2026-11-02' } } }
        : item;
    await wakeAt('2026-11-03T00:00:00Z');
    expect(copiesOf(await w.items('A'), ended)).toHaveLength(0);
    expect(rows()).toMatchObject([{ item_id: ended.id, next_at: null }]);
    // Gone by its day: its row goes.
    const gone = await repeating('Gone');
    push.read = (item) => (item?.id === gone.id ? null : item);
    await wakeAt('2026-11-04T00:00:00Z');
    expect(rows().map((r) => r['item_id'])).toEqual([ended.id]);
  });

  it('asks for a wake now after a restart with a rule still unsettled, and none once purged', async () => {
    await w.make('A', { title: 'Restarted', repeat: RULE });
    plan().restart();
    await woken();
    expect(schedule().at).toBe(Date.now());
    await plan().room.purge('A');
    expect(schedule().at).toBeNull();
  });
});
