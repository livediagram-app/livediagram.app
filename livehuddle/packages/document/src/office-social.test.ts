import { describe, expect, it } from 'vitest';
import { createShape } from './shape-factory';
import { OFFICE_ART } from './office';
import {
  CLOCK_ZONES_MAX,
  isClockZone,
  isClockZones,
  isJukeboxSource,
  isNoticeNote,
  isNoticeNotes,
  mergeNoticeNotes,
  notesNewestFirst,
  NOTES_MAX,
  NOTE_TEXT_MAX,
  OFFICE_SOCIAL_ART,
  pondParts,
  zoneCityLabel,
  type NoticeNote,
} from './office-social';
import { isValidElement } from './validate';
import { applyParticipantOp } from './participant-content';
import type { Element, Tab } from './index';

// docs/specs/009-elements/social-pieces.md
const GRID_KINDS = Object.keys(OFFICE_SOCIAL_ART) as (keyof typeof OFFICE_SOCIAL_ART)[];

describe('the social pieces', () => {
  it('draws every grid piece at its own size, with no words, aspect locked', () => {
    expect(GRID_KINDS).toHaveLength(12);
    for (const kind of GRID_KINDS) {
      const art = OFFICE_ART[kind].front;
      expect(art).toBe(OFFICE_SOCIAL_ART[kind].front);
      expect(art.parts.length, kind).toBeGreaterThan(0);
      const el = createShape(kind, 0, 0);
      expect(el.width, kind).toBe(art.width);
      expect(el.height, kind).toBe(art.height);
      expect(el.label, kind).toBe('');
      expect(el.aspectLocked, kind).toBe(true);
    }
  });

  it('seats two at a ping-pong table and a bench, six at a picnic table and one in a hammock', () => {
    expect(OFFICE_ART['ping-pong-table'].front.seats).toHaveLength(2);
    expect(OFFICE_ART.bench.front.seats).toHaveLength(2);
    expect(OFFICE_ART['picnic-table'].front.seats).toHaveLength(6);
    expect(OFFICE_ART.hammock.front.seats).toHaveLength(1);
  });

  it('makes a pond any size, its parts within its box', () => {
    const el = createShape('pond', 0, 0);
    expect(el.aspectLocked).toBeFalsy();
    for (const [w, h] of [
      [240, 152],
      [600, 120],
      [60, 60],
    ] as const) {
      const parts = pondParts(w, h);
      expect(parts.length).toBeGreaterThan(1);
      for (const p of parts) {
        if (p.tag === 'path') continue;
        const left = p.tag === 'rect' ? p.x : p.cx - p.rx;
        const right = p.tag === 'rect' ? p.x + p.w : p.cx + p.rx;
        expect(left).toBeGreaterThanOrEqual(0);
        expect(right).toBeLessThanOrEqual(w);
      }
    }
  });
});

const note = (id: string, by: string, at = 1, extra: Partial<NoticeNote> = {}): NoticeNote => ({
  id,
  text: `Note ${id}`,
  author: 'Sam',
  by,
  at,
  ...extra,
});

describe('notice board notes', () => {
  it('accepts a well-formed note and refuses a long, empty or badly coloured one', () => {
    expect(isNoticeNote(note('a', 'k'))).toBe(true);
    expect(isNoticeNote(note('a', 'k', 1, { title: 'Lunch', color: 'pink' }))).toBe(true);
    expect(isNoticeNote(note('a', 'k', 1, { text: 'x'.repeat(NOTE_TEXT_MAX + 1) }))).toBe(false);
    expect(isNoticeNote(note('a', 'k', 1, { text: '' }))).toBe(false);
    expect(isNoticeNote(note('a', 'k', 1, { color: 'orange' as never }))).toBe(false);
    expect(isNoticeNote({ id: 'a', text: 'hi' })).toBe(false);
  });

  it('refuses a list with a repeated id or past the most a board holds', () => {
    expect(isNoticeNotes([note('a', 'k'), note('b', 'k')])).toBe(true);
    expect(isNoticeNotes([note('a', 'k'), note('a', 'k')])).toBe(false);
    const many = Array.from({ length: NOTES_MAX + 1 }, (_, i) => note(`n${i}`, 'k'));
    expect(isNoticeNotes(many)).toBe(false);
  });

  it('lists the newest first', () => {
    const list = notesNewestFirst([note('old', 'k', 1), note('new', 'k', 3), note('mid', 'k', 2)]);
    expect(list.map((n) => n.id)).toEqual(['new', 'mid', 'old']);
    expect(notesNewestFirst(undefined)).toEqual([]);
  });

  it("merges a participant's change: adds and removes only its own, keeps everyone else's", () => {
    const stored = [note('mine', 'me'), note('theirs', 'them')];
    // Pins one, unpins its own, and tries to unpin theirs and forge one in their name.
    const incoming = [note('new', 'me'), note('forged', 'them')];
    const merged = mergeNoticeNotes(stored, incoming, 'me');
    expect(merged?.map((n) => n.id)).toEqual(['theirs', 'new']);
    // With no adder key nothing changes.
    expect(mergeNoticeNotes(stored, [], null)?.map((n) => n.id)).toEqual(['mine', 'theirs']);
  });
});

describe('world clock zones and the jukebox source', () => {
  it('takes IANA zone names with a short label, up to six', () => {
    expect(isClockZone({ zone: 'Europe/London', label: 'London' })).toBe(true);
    expect(isClockZone({ zone: 'America/Argentina/Buenos_Aires', label: 'BA' })).toBe(true);
    expect(isClockZone({ zone: 'UTC', label: 'UTC' })).toBe(true);
    expect(isClockZone({ zone: '../etc', label: 'x' })).toBe(false);
    expect(isClockZone({ zone: 'Europe/London', label: 'x'.repeat(25) })).toBe(false);
    const z = { zone: 'Asia/Tokyo', label: 'Tokyo' };
    expect(isClockZones(Array.from({ length: CLOCK_ZONES_MAX }, () => z))).toBe(true);
    expect(isClockZones(Array.from({ length: CLOCK_ZONES_MAX + 1 }, () => z))).toBe(false);
  });

  it('names a zone by its city', () => {
    expect(zoneCityLabel('America/New_York')).toBe('New York');
    expect(zoneCityLabel('UTC')).toBe('UTC');
  });

  it('takes only an https link as a jukebox source', () => {
    expect(isJukeboxSource('https://example.com/stream.mp3')).toBe(true);
    expect(isJukeboxSource('http://example.com/stream.mp3')).toBe(false);
    expect(isJukeboxSource('javascript:alert(1)')).toBe(false);
    expect(isJukeboxSource(`https://example.com/${'a'.repeat(500)}`)).toBe(false);
  });

  it('validates the fields on the element', () => {
    const clock = {
      ...createShape('world-clock', 0, 0),
      clockZones: [{ zone: 'Europe/Paris', label: 'Paris' }],
    };
    expect(isValidElement(clock)).toBe(true);
    expect(isValidElement({ ...clock, clockZones: [{ zone: 'nope nope', label: 'x' }] })).toBe(
      false,
    );
    const box = createShape('jukebox', 0, 0);
    expect(isValidElement({ ...box, jukeboxSource: 'https://example.com/a.mp3' })).toBe(true);
    expect(isValidElement({ ...box, jukeboxSource: 'ftp://example.com/a.mp3' })).toBe(false);
    const board = createShape('notice-board', 0, 0);
    expect(isValidElement({ ...board, noticeNotes: [note('a', 'k')] })).toBe(true);
    expect(isValidElement({ ...board, noticeNotes: [{ id: 'a' }] })).toBe(false);
  });
});

// docs/specs/013-workspace/share-roles.md: a Participant pins and unpins its own notes on a board an Editor placed.
describe('a participant on a notice board', () => {
  const ME = 'a'.repeat(32);
  const THEM = 'b'.repeat(32);
  const board = (notes: NoticeNote[], extra: Record<string, unknown> = {}): Element => ({
    ...createShape('notice-board', 0, 0),
    id: 'nb',
    noticeNotes: notes,
    ...extra,
  });
  const tab = (el: Element): Tab => ({ id: 't', name: 'Office', elements: [el] });
  const notesOf = (t: Tab) =>
    ((t.elements[0] as { noticeNotes?: NoticeNote[] }).noticeNotes ?? []).map((n) => n.id);

  it('pins its own note, keeping the others', () => {
    const r = applyParticipantOp(
      tab(board([note('t1', THEM)])),
      { kind: 'update', element: board([note('t1', THEM), note('m1', ME)]) },
      ME,
    );
    expect(r.result).toBe('applied');
    if (r.result === 'applied') expect(notesOf(r.tab)).toEqual(['t1', 'm1']);
  });

  it("cannot unpin someone else's note or sign one in their name", () => {
    const r = applyParticipantOp(
      tab(board([note('t1', THEM)])),
      { kind: 'update', element: board([note('fake', THEM)]) },
      ME,
    );
    if (r.result === 'applied') expect(notesOf(r.tab)).toEqual(['t1']);
  });

  it('unpins its own note', () => {
    const r = applyParticipantOp(
      tab(board([note('t1', THEM), note('m1', ME)])),
      { kind: 'update', element: board([note('t1', THEM)]) },
      ME,
    );
    expect(r.result).toBe('applied');
    if (r.result === 'applied') expect(notesOf(r.tab)).toEqual(['t1']);
  });

  it('cannot move or restyle the board, and pins on one saved locked', () => {
    const r = applyParticipantOp(
      tab(board([])),
      { kind: 'update', element: board([note('m1', ME)], { x: 500, fillColor: '#ff0000' }) },
      ME,
    );
    if (r.result === 'applied') {
      expect(r.tab.elements[0]).toMatchObject({ x: 0 });
      expect(notesOf(r.tab)).toEqual(['m1']);
    }
    // not-in-livehuddle.md "Element and Tab Locking": a board saved locked takes notes like any other.
    const locked = applyParticipantOp(
      tab(board([], { locked: true })),
      { kind: 'update', element: board([note('m1', ME)], { locked: true }) },
      ME,
    );
    expect(locked.result).toBe('applied');
  });
});
