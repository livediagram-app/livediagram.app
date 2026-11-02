import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { RepeatRule } from '@liveplanner/items';
import {
  createPlan,
  endRepeatWorld,
  repeatWorld,
  type RepeatWorld,
} from '../plan-room/test-repeat-world';

// Who may repeat a card (docs/specs/026-plan/items.md "Repeating cards", docs/specs/013-workspace/share-roles.md): an
// Editor sets, changes and stops a repeat; a Participant's other edits to a repeating card still land; a Viewer
// writes nothing.
vi.mock(
  '../auth/accounts',
  async () => (await import('../plan-room/test-accounts-mock')).accountsMock,
);

const RULE: RepeatRule = { every: 'day', from: '2026-11-02', timeZone: 'Europe/London' };
const PARTICIPANT = 'guest_part';
const VIEWER = 'guest_view';

let w: RepeatWorld;
beforeEach(async () => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(Date.parse('2026-11-02T10:00:00Z'));
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'debug').mockImplementation(() => {});
  w = repeatWorld();
  w.levels.set(PARTICIPANT, 'participate');
  w.levels.set(VIEWER, 'view');
  await createPlan(w, 'A');
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  endRepeatWorld();
});

const patch = (id: string, body: unknown, person?: string) =>
  w.send('POST', `/api/projects/A/items/${id}`, body, person);

describe('the repeat gate', () => {
  it('lets an Editor set, change and stop a repeat', async () => {
    const card = await w.make('A', { title: 'Report' });
    expect((await patch(card.id, { set: { repeat: RULE } })).status).toBe(200);
    expect((await patch(card.id, { set: { repeat: { ...RULE, every: 'weekday' } } })).status).toBe(
      200,
    );
    expect((await patch(card.id, { clear: ['repeat'] })).status).toBe(200);
    const made = await w.make('A', { title: 'Made repeating', repeat: RULE });
    expect(made.fields['repeat']).toEqual(RULE);
  });

  it('refuses a Participant setting, changing or stopping one, and keeps their other edits', async () => {
    const plain = await w.make('A', { title: 'Plain' });
    const repeating = await w.make('A', { title: 'Repeating', repeat: RULE });
    expect((await patch(plain.id, { set: { repeat: RULE } }, PARTICIPANT)).status).toBe(403);
    expect(
      (await patch(repeating.id, { set: { repeat: { ...RULE, every: 'weekday' } } }, PARTICIPANT))
        .status,
    ).toBe(403);
    expect((await patch(repeating.id, { clear: ['repeat'] }, PARTICIPANT)).status).toBe(403);
    const many = await w.send(
      'POST',
      '/api/projects/A/items/patches',
      { items: [{ id: plain.id, set: { repeat: RULE } }] },
      PARTICIPANT,
    );
    expect(many.status).toBe(403);
    const create = await w.send(
      'POST',
      '/api/projects/A/items',
      { type: 'task', fields: { title: 'Sneaky', repeat: RULE }, place: { status: 'todo' } },
      PARTICIPANT,
    );
    expect(create.status).toBe(403);
    // Their ordinary edit to a repeating card lands, and the rule stays.
    const edit = await patch(repeating.id, { set: { title: 'Renamed' } }, PARTICIPANT);
    expect(edit.status).toBe(200);
    const items = await w.items('A');
    expect(items.find((i) => i.id === repeating.id)?.fields).toMatchObject({
      title: 'Renamed',
      repeat: RULE,
    });
    expect(items.find((i) => i.id === plain.id)?.fields['repeat']).toBeUndefined();
  });

  it('refuses a Viewer, and a rule that is not one', async () => {
    const card = await w.make('A', { title: 'Report' });
    expect((await patch(card.id, { set: { repeat: RULE } }, VIEWER)).status).toBe(403);
    const bad = await patch(card.id, { set: { repeat: { ...RULE, timeZone: 'Nowhere/City' } } });
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ error: 'field_value_invalid' });
  });
});
