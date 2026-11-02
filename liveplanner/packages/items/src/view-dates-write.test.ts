import { describe, expect, it } from 'vitest';
import { boardCsvImport, boardCsvRows } from './board-csv';
import type { PlanBoardSetup } from './board';
import { boardSortFieldsOf, sortCards } from './board-sort';
import { calendarMove } from './calendar-move';
import { customFieldText } from './card-text';
import type { Item, ItemFields } from './item';
import { ITEM_TYPES, type CustomFieldDef, type ItemTypeDef } from './item-types';
import { dayNumber } from './plan-view-dates';
import { calendarModel } from './plan-view-charts';
import { ganttDrag, ganttDrawn, ganttModel } from './plan-view-gantt';
import { resolveFields } from './plan-names';
import { canBeRequired, missingRequiredFields } from './required-fields';
import { item } from './test-items';
import {
  defaultCatalogue,
  ITEM_TYPE_CATALOGUE_VERSION,
  validateItemTypeCatalogue,
} from './type-catalogue';
import { applyCardTypeChanges } from './type-changes';
import { roleDay, roleDays, roleMoment, roleValue } from './view-dates-write';
import { viewDateName, viewDateOptions, viewDatesOf } from './view-fields';
import { viewNeeds } from './plan-views';
import { dateTimeText, parseDateTime } from './date-time-fields';

// Date and Time, Date Range and Phone fields everywhere a plan reads and writes them (docs/specs/026-plan/item-types.md
// "Date and Time", "Date Range", "Phone"; plan-views.md "Times and ranges").

const MEETING: CustomFieldDef = { id: 'f-meeting', label: 'Meeting', kind: 'datetime' };
const TRIP: CustomFieldDef = { id: 'f-trip', label: 'Trip', kind: 'daterange' };
const SLOT: CustomFieldDef = { id: 'f-slot', label: 'Slot', kind: 'daterange', withTime: true };
const PHONE: CustomFieldDef = { id: 'f-phone', label: 'Phone', kind: 'phone' };
const event: ItemTypeDef = {
  ...ITEM_TYPES[1],
  id: 'event',
  label: 'Event',
  fields: ['title', 'status', 'start', 'due', 'f-meeting', 'f-trip', 'f-slot', 'f-phone'],
  custom: [MEETING, TRIP, SLOT, PHONE],
};
const LONDON = 'Europe/London';
const TOKYO = 'Asia/Tokyo';
const day = (iso: string) => dayNumber(iso)!;
const naming = { statuses: [{ status: 'todo', name: 'To Do' }], items: [] };
const card = (fields: ItemFields, id = 'a') =>
  item({ title: 'A', status: 'todo', ...fields }, { type: 'event', id });

describe('the views’ date fields', () => {
  it('lists every Date, Date and Time and Date Range field, and reads each one’s shape', () => {
    expect(viewDateOptions([event], 'due').map((o) => o.id)).toEqual([
      'due',
      'f-meeting',
      'f-trip',
      'f-slot',
    ]);
    expect(viewDatesOf({ dueField: 'f-meeting' }, [event])).toEqual({
      start: 'start',
      due: 'f-meeting',
      shapes: { due: 'datetime' },
    });
    expect(viewDatesOf({ startField: 'f-trip', dueField: 'f-slot' }, [event]).shapes).toEqual({
      start: 'daterange',
      due: 'daterange-time',
    });
    expect(viewDatesOf({ dueField: 'f-phone' }, [event])).toEqual({ start: 'start', due: 'due' });
    expect(viewDateName([event], 'f-trip')).toBe('Trip');
    expect(viewNeeds('calendar', { dueField: 'f-meeting' }, [event])).toEqual(['f-meeting']);
  });

  it('reads a role’s date: a moment, a range’s end', () => {
    const dates = viewDatesOf({ startField: 'f-trip', dueField: 'f-trip' }, [event]);
    const c = card({ 'f-trip': ['2026-10-31', '2026-11-02'] });
    expect(roleValue(c, dates, 'start')).toBe('2026-10-31');
    expect(roleDay(c, dates, 'due')).toBe(day('2026-11-02'));
    expect(roleMoment(c, dates, 'due')).toBeUndefined();
    const timed = viewDatesOf({ dueField: 'f-meeting' }, [event]);
    const m = card({ 'f-meeting': '2026-10-31T17:00:00Z' });
    expect(roleMoment(m, timed, 'due')).toBe(Date.UTC(2026, 9, 31, 17));
    // The viewer's day: Sunday in Tokyo.
    expect(roleDay(m, timed, 'due', TOKYO)).toBe(day('2026-11-01'));
  });
});

describe('writing days back in each field’s shape', () => {
  it('keeps a moment’s time of day, across a clock change', () => {
    const dates = viewDatesOf({ dueField: 'f-meeting' }, [event]);
    const c = card({ 'f-meeting': '2026-10-23T08:00:00Z[Europe/London]' });
    expect(roleDays(c, dates, { due: day('2026-10-26') }, LONDON)).toEqual({
      'f-meeting': '2026-10-26T09:00:00Z[Europe/London]',
    });
    expect(roleDays(c, dates, { start: day('2026-10-26') })).toEqual({ start: '2026-10-26' });
  });

  it('moves a range’s ends, both roles of one range in one value', () => {
    const dates = viewDatesOf({ startField: 'f-trip', dueField: 'f-trip' }, [event]);
    const c = card({ 'f-trip': ['2026-10-31', '2026-11-02'] });
    expect(roleDays(c, dates, { start: day('2026-11-03'), due: day('2026-11-05') })).toEqual({
      'f-trip': ['2026-11-03', '2026-11-05'],
    });
    expect(roleDays(card({}), dates, { start: day('2026-11-03'), due: day('2026-11-05') })).toEqual(
      { 'f-trip': ['2026-11-03', '2026-11-05'] },
    );
    const timed = viewDatesOf({ startField: 'f-slot', dueField: 'f-slot' }, [event]);
    const s = card({ 'f-slot': ['2026-10-31T09:00:00Z', '2026-10-31T17:00:00Z'] });
    expect(roleDays(s, timed, { due: day('2026-11-02') }, LONDON)).toEqual({
      'f-slot': ['2026-10-31T09:00:00Z', '2026-11-02T17:00:00Z[Europe/London]'],
    });
  });
});

describe('calendars', () => {
  it('place a moment on the viewer’s day, untimed cards first then by time', () => {
    const dates = viewDatesOf({ dueField: 'f-meeting' }, [event]);
    const items = [
      card({ 'f-meeting': '2026-10-14T11:30:00Z' }, 'late'),
      card({ 'f-meeting': '2026-10-14T11:00:00Z' }, 'early'),
    ];
    const plain = item({ title: 'P', status: 'todo', due: '2026-10-14' }, { type: 'event' });
    const model = calendarModel([...items, plain], new Map(), 2026, 9, 'due', dates);
    // The viewer's day for those moments, whatever the runtime's zone.
    const cell = model.weeks.flat().find((d) => d.day === dayNumber('2026-10-14T11:00:00Z'))!;
    expect(cell.cards.map((c) => c.item.id)).toEqual(['early', 'late']);
    expect(cell.cards[0]!.at).toBe(Date.UTC(2026, 9, 14, 11));
    const mixed = calendarModel(
      [plain, card({ due: '2026-10-14' }, 'b')],
      new Map(),
      2026,
      9,
      'due',
    );
    expect(
      mixed.weeks.flat().find((d) => d.day === day('2026-10-14'))!.cards[0]!.at,
    ).toBeUndefined();
  });

  it('move a moment by whole days keeping its time, and a range’s end with the start carried', () => {
    const dates = viewDatesOf({ dueField: 'f-meeting' }, [event]);
    const c = card({ 'f-meeting': '2026-10-14T09:00:00Z', start: '2026-10-13' });
    const m = calendarMove(c, 'due', day('2026-10-12'), dates, LONDON)!;
    expect(m.set).toEqual({
      'f-meeting': '2026-10-12T09:00:00Z[Europe/London]',
      start: '2026-10-11',
    });
    expect(m.carried).toBe(true);
    const range = viewDatesOf({ startField: 'f-trip', dueField: 'f-trip' }, [event]);
    const t = card({ 'f-trip': ['2026-10-31', '2026-11-02'] });
    expect(calendarMove(t, 'due', day('2026-10-30'), range)).toEqual({
      set: { 'f-trip': ['2026-10-28', '2026-10-30'] },
      days: -3,
      carried: true,
    });
    expect(calendarMove(t, 'start', day('2026-10-31'), range)).toBeNull();
  });
});

describe('the Gantt chart', () => {
  const now = new Date(Date.UTC(2026, 9, 31, 12));

  it('draws a range as a bar, and a timed Due overdue to the minute', () => {
    const range = viewDatesOf({ startField: 'f-trip', dueField: 'f-trip' }, [event]);
    const t = card({ 'f-trip': ['2026-10-20', '2026-10-24'] }, 't');
    const model = ganttModel([t], new Map(), now, ['event'], range);
    expect(model.rows[0]).toMatchObject({
      mark: 'bar',
      from: day('2026-10-20'),
      to: day('2026-10-24'),
      overdue: true,
    });
    const timed = viewDatesOf({ dueField: 'f-meeting' }, [event]);
    const soon = card({ 'f-meeting': '2026-10-31T17:00:00Z' }, 's');
    const gone = card({ 'f-meeting': '2026-10-31T09:00:00Z' }, 'g');
    const rows = ganttModel([soon, gone], new Map(), now, ['event'], timed).rows;
    expect(rows.find((r) => r.item.id === 's')!.overdue).toBe(false);
    expect(rows.find((r) => r.item.id === 'g')!.overdue).toBe(true);
  });

  it('drags and draws in each field’s shape', () => {
    const range = viewDatesOf({ startField: 'f-trip', dueField: 'f-trip' }, [event]);
    const t = card({ 'f-trip': ['2026-10-20', '2026-10-24'] }, 't');
    const [row] = ganttModel([t], new Map(), now, ['event'], range).rows;
    expect(ganttDrag(row!, 'bar', 2, range)!.set).toEqual({
      'f-trip': ['2026-10-22', '2026-10-26'],
    });
    expect(ganttDrag(row!, 'to', 1, range)!.set).toEqual({
      'f-trip': ['2026-10-20', '2026-10-25'],
    });
    expect(ganttDrag(row!, 'from', -1, range)!.set).toEqual({
      'f-trip': ['2026-10-19', '2026-10-24'],
    });
    expect(ganttDrawn(day('2026-10-20'), day('2026-10-20'), range).set).toEqual({
      'f-trip': ['2026-10-20', '2026-10-26'],
    });
    expect(ganttDrawn(day('2026-10-20'), day('2026-10-22')).set).toEqual({
      start: '2026-10-20',
      due: '2026-10-22',
    });
    const timed = viewDatesOf({ dueField: 'f-meeting' }, [event]);
    const m = card({ 'f-meeting': '2026-10-31T17:00:00Z' }, 'm');
    const [mark] = ganttModel([m], new Map(), now, ['event'], timed).rows;
    expect(mark!.mark).toBe('due');
    expect(ganttDrag(mark!, 'mark', 1, timed)!.set).toEqual({
      'f-meeting': expect.stringMatching(/^2026-11-01T17:00:00Z|^2026-11-01T1\d:00:00Z/),
    });
  });
});

describe('the card, sort, required and catalogue', () => {
  it('reads each kind on the card', () => {
    expect(customFieldText(MEETING, '2026-10-31T17:00:00Z')).toBe(
      dateTimeText('2026-10-31T17:00:00Z', 'short'),
    );
    expect(customFieldText(TRIP, ['2026-10-31', '2026-11-02'])).toContain(' to ');
    expect(customFieldText(PHONE, '+44 20 7946 0958')).toBe('+44 20 7946 0958');
    expect(customFieldText(MEETING, 'soon')).toBeNull();
  });

  it('sorts a moment by its moment and a range by its start, earliest first', () => {
    expect(boardSortFieldsOf([event]).filter((f) => f.id.startsWith('f-'))).toEqual([
      { id: 'f-meeting', label: 'Meeting', kind: 'date' },
      { id: 'f-trip', label: 'Trip', kind: 'date' },
      { id: 'f-slot', label: 'Slot', kind: 'date' },
    ]);
    const a = card(
      { 'f-meeting': '2026-10-31T17:00:00Z', 'f-trip': ['2026-11-05', '2026-11-06'] },
      'a',
    );
    const b = card(
      { 'f-meeting': '2026-10-31T09:00:00Z', 'f-trip': ['2026-11-01', '2026-11-09'] },
      'b',
    );
    const none = card({}, 'none');
    const ids = (field: string) =>
      sortCards([none, a, b], [{ field, dir: 'asc' }], [event]).map((c) => c.id);
    // A card with no value sorts last.
    expect(ids('f-meeting')).toEqual(['b', 'a', 'none']);
    expect(ids('f-trip')).toEqual(['b', 'a', 'none']);
    const s1 = card({ 'f-slot': ['2026-11-01T10:00:00Z', '2026-11-01T11:00:00Z'] }, 's1');
    const s2 = card({ 'f-slot': ['2026-11-01T08:00:00Z', '2026-11-01T12:00:00Z'] }, 's2');
    expect(
      sortCards([s1, s2], [{ field: 'f-slot', dir: 'asc' }], [event]).map((c) => c.id),
    ).toEqual(['s2', 's1']);
  });

  it('may be required, and an empty range is no value', () => {
    for (const f of [MEETING, TRIP, PHONE]) expect(canBeRequired(f.kind)).toBe(true);
    const t = { ...event, custom: [{ ...TRIP, required: true }] };
    expect(missingRequiredFields(t, { 'f-trip': [] }).map((f) => f.id)).toEqual(['f-trip']);
  });

  it('keeps Include Time only on a Date Range, made once by an agent', () => {
    const stored = validateItemTypeCatalogue({
      version: ITEM_TYPE_CATALOGUE_VERSION,
      types: [
        {
          ...event,
          custom: [{ ...MEETING, withTime: true }, SLOT, TRIP, PHONE],
        },
      ],
    });
    if (!stored.ok) throw new Error(stored.reason);
    expect(stored.catalogue.types[0]!.custom!.map((c) => c.withTime)).toEqual([
      undefined,
      true,
      undefined,
      undefined,
    ]);
    const made = applyCardTypeChanges(
      defaultCatalogue(),
      [
        {
          op: 'add',
          name: 'Trip',
          custom: [
            { name: 'When', kind: 'daterange', withTime: true },
            { name: 'Call', kind: 'phone' },
          ],
        },
      ],
      naming.statuses,
    );
    if (!made.ok) throw new Error(made.message);
    expect(made.catalogue!.types.find((t) => t.label === 'Trip')!.custom).toEqual([
      { id: 'f-when', label: 'When', kind: 'daterange', withTime: true },
      { id: 'f-call', label: 'Call', kind: 'phone' },
    ]);
    const refused = applyCardTypeChanges(
      defaultCatalogue(),
      [{ op: 'add', name: 'Bad', custom: [{ name: 'When', kind: 'date', withTime: true }] }],
      naming.statuses,
    );
    expect(refused).toMatchObject({ ok: false });
  });
});

describe('agents', () => {
  it('write a moment with its offset, a range as an interval or a list, and a phone number', () => {
    expect(
      resolveFields(
        {
          Meeting: '2026-10-31T18:00:00+01:00',
          Trip: '2026-11-02/2026-10-31',
          Slot: ['2026-10-31T09:00Z', '2026-10-31T17:00Z'],
          Phone: ' +44 20 7946 0958 ',
        },
        event,
        naming,
      ),
    ).toEqual({
      ok: true,
      fields: {
        'f-meeting': '2026-10-31T17:00:00Z',
        'f-trip': ['2026-10-31', '2026-11-02'],
        'f-slot': ['2026-10-31T09:00:00Z', '2026-10-31T17:00:00Z'],
        'f-phone': '+44 20 7946 0958',
      },
    });
  });

  it('refuse each with what to give', () => {
    const msg = (fields: Record<string, unknown>) => {
      const r = resolveFields(fields, event, naming);
      return r.ok ? '' : r.message;
    };
    expect(msg({ Meeting: '2026-10-31T17:00' })).toContain('offset');
    expect(msg({ Meeting: 5 })).toContain('offset');
    expect(msg({ Trip: '2026-10-31' })).toContain('2026-10-31/2026-11-02');
    expect(msg({ Slot: ['2026-10-31', '2026-11-01'] })).toContain('offsets');
    expect(msg({ Phone: 'call me' })).toContain('phone number');
  });
});

describe('CSV', () => {
  const setup: PlanBoardSetup = {
    title: 'Events',
    columns: [{ id: 'c1', status: 'todo', name: 'To Do' }],
    swimlaneBy: 'none',
    cardFields: [],
    hideWriting: false,
    addTypes: ['event'],
  };

  it('writes ISO 8601 and the number as typed', () => {
    const rows = boardCsvRows(
      setup,
      new Map<string, Item>([
        [
          'a',
          card({
            'f-meeting': '2026-10-31T17:00:00Z[Europe/London]',
            'f-trip': ['2026-10-31', '2026-11-02'],
            'f-slot': ['2026-10-31T09:00:00Z', '2026-10-31T17:00:00Z'],
            'f-phone': '+44 20 7946 0958',
          }),
        ],
        ['b', card({}, 'b')],
      ]),
      [event],
    );
    const col = (h: string) => rows[0]!.indexOf(h);
    expect(rows[1]![col('Meeting')]).toBe('2026-10-31T17:00:00Z');
    expect(rows[1]![col('Trip')]).toBe('2026-10-31/2026-11-02');
    expect(rows[1]![col('Slot')]).toBe('2026-10-31T09:00:00Z/2026-10-31T17:00:00Z');
    expect(rows[1]![col('Phone')]).toBe('+44 20 7946 0958');
    expect([rows[2]![col('Meeting')], rows[2]![col('Trip')]]).toEqual(['', '']);
  });

  it('reads them back, a time with no offset in the importer’s zone, and an old apostrophe dropped', () => {
    const { creates } = boardCsvImport(
      [
        ['Title', 'Meeting', 'Trip', 'Slot', 'Phone'],
        [
          'A',
          '2026-10-31T17:00:00Z',
          '31/10/2026 to 2/11/2026',
          '2026-10-31T09:00Z/2026-10-31T17:00Z',
          "'+44 20 7946 0958",
        ],
        ['B', '2026-10-31 17:00', 'soon', 'later', 'call me'],
      ],
      { setup, types: [event], people: [], room: 100 },
    );
    expect(creates[0]!.fields).toMatchObject({
      'f-meeting': '2026-10-31T17:00:00Z',
      'f-trip': ['2026-10-31', '2026-11-02'],
      'f-slot': ['2026-10-31T09:00:00Z', '2026-10-31T17:00:00Z'],
      'f-phone': '+44 20 7946 0958',
    });
    expect(creates[1]!.fields['f-meeting']).toBe(
      parseDateTime('2026-10-31 17:00', { local: true }),
    );
    expect(creates[1]!.fields['f-trip']).toBeUndefined();
    expect(creates[1]!.fields['f-phone']).toBeUndefined();
  });
});
