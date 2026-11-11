import { describe, expect, it } from 'vitest';
import { EVENT_TYPES } from '@liveworkspace/index-client';
import { contrastRatio } from '@liveworkspace/brand/colour';
import { makeEvent } from '../test/fakeClient';
import { EVENT_GLYPH_PATHS } from './event-icons';
import {
  dateKey,
  eventCategory,
  eventLabel,
  eventTone,
  formatDay,
  sortCategories,
  timeLabel,
  TONE_INKS,
  toneColor,
  toneDarkInk,
  type EventTone,
} from './history-model';
import { actorWords, eventWords } from './history-render';
import { initials, personName } from './person-name';

const noon = new Date(2026, 9, 21, 12).getTime();

// The reader's locale words a day; these say what it must hold, in whatever order the locale gives.
const dayIn = (y: number, m: number, d: number, year = false) =>
  new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(year ? { year: 'numeric' } : {}),
  }).format(new Date(y, m - 1, d));

describe('what an event in History says', () => {
  it('says what happened in the item’s own words', () => {
    expect(eventLabel(makeEvent(1, { type: 'renamed' }))).toBe('Plan Renamed');
    expect(eventLabel(makeEvent(1, { type: 'created', app: 'livediagram' }))).toBe(
      'Canvas Created',
    );
    expect(eventLabel(makeEvent(1, { type: 'created', detail: { source: 'ai' } }))).toBe(
      'Plan Made by AI',
    );
    expect(eventLabel(makeEvent(1, { type: 'created', detail: { source: 'import' } }))).toBe(
      'Plan Imported',
    );
    expect(eventLabel(makeEvent(1, { type: 'created', detail: { copiedFrom: 'x' } }))).toBe(
      'Plan Copied',
    );
    expect(eventLabel(makeEvent(1, { type: 'edited' }))).toBe('Plan Updated');
    expect(eventLabel(makeEvent(1, { type: 'commented' }))).toBe('Comment Added');
    expect(eventLabel(makeEvent(1, { type: 'synced' }))).toBe('Synced to the Cloud');
    expect(
      eventLabel(makeEvent(1, { type: 'team_member_removed', detail: { left: '1' } } as never)),
    ).toBe('Member Left');
    // A kind the dialog has not met yet still reads, as a change to the item.
    expect(eventLabel(makeEvent(1, { type: 'mystery' as never }))).toBe('Plan Changed');
    expect(eventLabel(makeEvent(1, { type: 'mystery' as never, app: 'nope' as never }))).toBe(
      'Item Changed',
    );
  });

  it('gives every event type a tone, a category and a glyph of its own', () => {
    for (const type of EVENT_TYPES) {
      expect(eventTone(type)).not.toBe('neutral');
      expect(eventCategory(type)).not.toBe('other');
    }
    expect(eventTone('mystery')).toBe('neutral');
    expect(eventCategory('mystery')).toBe('other');
    const paths = Object.values(EVENT_GLYPH_PATHS);
    expect(new Set(paths).size).toBe(paths.length);
    expect(eventTone('trashed')).toBe('danger');
    expect(sortCategories(['other', 'edits', 'comments'])).toEqual(['comments', 'edits', 'other']);
  });

  it('keeps each tone’s ink at 4.5:1 or more on a dark surface, as on a light one', () => {
    const tones: EventTone[] = ['danger', 'structural', 'create', 'neutral'];
    for (const tone of tones) {
      for (const surface of ['#0f172a', '#020617'])
        expect(contrastRatio(toneDarkInk(tone), surface)).toBeGreaterThanOrEqual(4.5);
      const light = /,\s*(#[0-9a-f]{6})\)$/i.exec(toneColor(tone))?.[1];
      expect(contrastRatio(light!, '#ffffff')).toBeGreaterThanOrEqual(4.5);
      expect(TONE_INKS).toContain(`dark:[--lw-event-ink-${tone}:${toneDarkInk(tone)}]`);
    }
  });

  it('words who did it and what it changed', () => {
    expect(actorWords(makeEvent(1, { actorId: 'user_me' }), 'user_me')).toBe('you');
    expect(actorWords(makeEvent(1, { actorId: 'user_o', actorName: 'Sam' }), 'user_me')).toBe(
      'Sam',
    );
    expect(actorWords(makeEvent(1, { actorId: 'deleted', actorName: null }), null)).toBe(
      'a closed account',
    );
    expect(
      actorWords(makeEvent(1, { type: 'opened_by_visitor', actorId: null, actorName: null }), null),
    ).toBe('a visitor');
    expect(actorWords(makeEvent(1, { actorId: 'user_o', actorName: null }), null)).toBe(
      'a teammate',
    );
    const team = (id: string | null) => (id === 't1' ? 'Platform' : null);
    const words = (over: Parameters<typeof makeEvent>[1]) =>
      eventWords(makeEvent(1, over), 'user_me', team);
    expect(words({ type: 'renamed', detail: { from: 'Q3' } }).detail).toBe('Was “\u2068Q3\u2069”');
    // The old name is isolated (FSI/PDI), so a right-to-left name cannot reorder the words around it.
    expect(words({ type: 'renamed', detail: null }).detail).toBeNull();
    expect(words({ type: 'moved', detail: { folderName: 'Launches' } }).detail).toBe('To Launches');
    expect(words({ type: 'moved', detail: { teamId: 't1' } }).detail).toBe('To Platform');
    expect(words({ type: 'moved', detail: { teamId: 'gone' } }).detail).toBeNull();
    expect(words({ type: 'moved', detail: {} }).detail).toBe('To My Work');
    expect(words({ type: 'shared', detail: { level: 'edit' } }).detail).toBe(
      'Anyone with the link can edit',
    );
    expect(words({ type: 'shared', detail: {} }).detail).toBe('Shared by link');
    expect(words({ type: 'commented', detail: { text: 'Hi', count: '3' } })).toEqual({
      detail: '3 comments',
      quote: 'Hi',
    });
    expect(words({ type: 'commented', detail: { text: 'Hi' } })).toEqual({
      detail: null,
      quote: 'Hi',
    });
    expect(words({ type: 'comment_resolved', detail: { text: 'Done' } }).quote).toBe('Done');
    expect(words({ type: 'comment_resolved', detail: null }).quote).toBeNull();
    expect(
      words({ type: 'action_assigned', detail: { action: 'Ship', assigneeId: 'user_me' } }),
    ).toEqual({ detail: 'To you', quote: 'Ship' });
    expect(words({ type: 'action_assigned', detail: { assigneeName: 'Ana' } })).toEqual({
      detail: 'To Ana',
      quote: null,
    });
    expect(words({ type: 'action_assigned', detail: {} }).detail).toBe('To a teammate');
    expect(words({ type: 'action_done', detail: { action: 'Ship' } }).quote).toBe('Ship');
    expect(words({ type: 'action_done', detail: null }).quote).toBeNull();
    expect(words({ type: 'favourited' })).toEqual({ detail: null, quote: null });
  });

  it('names people and their initials', () => {
    expect(personName({ actorId: 'user_o', actorName: ' Sam Lee ' })).toBe('Sam Lee');
    expect(personName({ actorId: 'deleted', actorName: null })).toBe('A closed account');
    expect(personName({ actorId: 'user_o', actorName: null })).toBe('A teammate');
    expect(initials('Sam Lee')).toBe('SL');
    expect(initials('Ana María Ruiz')).toBe('AR');
    expect(initials('A teammate')).toBeNull();
    expect(initials('A closed account')).toBeNull();
    expect(initials('   ')).toBeNull();
  });
});

describe('dates in the reader’s locale', () => {
  it('words a day, its year and a time as the locale does, never a forced one', () => {
    expect(dateKey(noon)).toBe('2026-10-21');
    expect(formatDay('2025-12-30')).toEqual({
      label: dayIn(2025, 12, 30),
      year: '2025',
      withYear: dayIn(2025, 12, 30, true),
    });
    expect(formatDay('not-a-day')).toEqual({ label: 'not-a-day', year: '', withYear: 'not-a-day' });
    expect(timeLabel(noon)).toBe(
      new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(noon),
    );
  });
});
