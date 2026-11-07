import { describe, expect, it } from 'vitest';
import type { ElementDelta, NoticeNote, ShapeElement } from './index';
import {
  applyElementDelta,
  CALENDAR_GRID,
  holdsNotes,
  isNoteDay,
  isNoticeNote,
  localDay,
  noteDay,
  NOTE_PIECE_KINDS,
  OFFICE_ART,
  OFFICE_TEAM_ART,
  PHOTO_FRAME_RECTS,
  PHOTO_FRAMES,
  SIGNPOST_BOARD_RECTS,
  SIGNPOST_BOARDS,
  SIGNPOST_TIP,
  signpostArrowPath,
  SUGGESTION_TEXT_MAX,
  SUGGESTIONS_MAX,
} from './index';

// The team pieces' model (docs/specs/009-elements/team-pieces.md): the drawings and their live spots, a calendar note's
// day, and the Calendar Wall taking the Notice Board's deltas.

describe('the team pieces’ art', () => {
  it('draws every kind in the office’s art, inside its grid', () => {
    expect(Object.keys(OFFICE_TEAM_ART).sort()).toEqual(
      ['calendar-wall', 'photo-wall', 'signpost', 'suggestion-box'].sort(),
    );
    for (const [kind, art] of Object.entries(OFFICE_TEAM_ART)) {
      expect(OFFICE_ART[kind as keyof typeof OFFICE_ART]).toBe(art);
      expect(art.front.parts.length).toBeGreaterThan(0);
    }
  });

  it('rules a calendar of six weeks inside the sheet', () => {
    const art = OFFICE_TEAM_ART['calendar-wall'].front;
    expect(CALENDAR_GRID.cols * CALENDAR_GRID.rows).toBe(42);
    expect(CALENDAR_GRID.x + CALENDAR_GRID.w).toBeLessThanOrEqual(art.width);
    expect(CALENDAR_GRID.y + CALENDAR_GRID.h).toBeLessThanOrEqual(art.height);
  });

  it('holds three boards whose arrows stay on the signpost either way', () => {
    const art = OFFICE_TEAM_ART.signpost.front;
    expect(SIGNPOST_BOARD_RECTS).toHaveLength(SIGNPOST_BOARDS);
    for (let i = 0; i < SIGNPOST_BOARDS; i += 1) {
      const r = SIGNPOST_BOARD_RECTS[i]!;
      expect(r.x - SIGNPOST_TIP).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w + SIGNPOST_TIP).toBeLessThanOrEqual(art.width);
      expect(signpostArrowPath(i, 'right')).toContain(`L${r.x + r.w + SIGNPOST_TIP} `);
      expect(signpostArrowPath(i, 'left')).toContain(`L${r.x - SIGNPOST_TIP} `);
    }
    expect(signpostArrowPath(SIGNPOST_BOARDS, 'right')).toBe('');
  });

  it('hangs eight frames, each mat inside its frame and every frame on the wall', () => {
    const art = OFFICE_TEAM_ART['photo-wall'].front;
    expect(PHOTO_FRAME_RECTS).toHaveLength(PHOTO_FRAMES);
    for (const f of PHOTO_FRAME_RECTS) {
      expect(f.x + f.w).toBeLessThanOrEqual(art.width);
      expect(f.y + f.h).toBeLessThanOrEqual(art.height);
      expect(f.mat.x).toBeGreaterThan(f.x);
      expect(f.mat.x + f.mat.w).toBeLessThan(f.x + f.w);
      expect(f.mat.y + f.mat.h).toBeLessThan(f.y + f.h);
    }
  });

  it('bounds the suggestion box', () => {
    expect(SUGGESTION_TEXT_MAX).toBe(500);
    expect(SUGGESTIONS_MAX).toBe(200);
  });
});

describe('a calendar note’s day', () => {
  it('takes real days only', () => {
    expect(isNoteDay('2026-11-05')).toBe(true);
    expect(isNoteDay('2028-02-29')).toBe(true);
    expect(isNoteDay('2026-02-29')).toBe(false);
    expect(isNoteDay('2026-13-01')).toBe(false);
    expect(isNoteDay('2026-00-10')).toBe(false);
    expect(isNoteDay('2026-04-31')).toBe(false);
    expect(isNoteDay('2026-04-00')).toBe(false);
    expect(isNoteDay('1999-01-01')).toBe(false);
    expect(isNoteDay('2101-01-01')).toBe(false);
    expect(isNoteDay('2026-1-05x')).toBe(false);
    expect(isNoteDay('2026/11/05')).toBe(false);
    expect(isNoteDay('20a6-11-05')).toBe(false);
    expect(isNoteDay(20261105)).toBe(false);
  });

  it('falls back to the day it was pinned on this clock', () => {
    const at = new Date(2026, 10, 7, 9, 30).getTime();
    expect(localDay(at)).toBe('2026-11-07');
    const n: NoticeNote = { id: 'a', text: 'Standup', author: 'Sam', by: 'k', at };
    expect(noteDay(n)).toBe('2026-11-07');
    expect(noteDay({ ...n, day: '2026-11-20' })).toBe('2026-11-20');
  });

  it('is checked with the rest of the note', () => {
    const n = { id: 'a', text: 'Standup', author: 'Sam', by: 'k', at: 1 };
    expect(isNoticeNote(n)).toBe(true);
    expect(isNoticeNote({ ...n, day: '2026-11-20' })).toBe(true);
    expect(isNoticeNote({ ...n, day: '2026-11-31' })).toBe(false);
    expect(isNoticeNote({ ...n, day: 5 })).toBe(false);
  });

  it('is held by the notice board and the calendar wall alone', () => {
    expect([...NOTE_PIECE_KINDS]).toEqual(['notice-board', 'calendar-wall']);
    expect(holdsNotes('calendar-wall')).toBe(true);
    expect(holdsNotes('notice-board')).toBe(true);
    expect(holdsNotes('suggestion-box')).toBe(false);
  });
});

describe('a Calendar Wall takes the Notice Board’s deltas', () => {
  const calendar = (over: Partial<ShapeElement> = {}): ShapeElement => ({
    id: 'cal',
    type: 'shape',
    shape: 'calendar-wall',
    x: 0,
    y: 0,
    width: 200,
    height: 160,
    ...over,
  });
  const note: NoticeNote = {
    id: 'n1',
    text: 'Offsite',
    author: 'Sam',
    by: 'adder-a',
    at: 1,
    day: '2026-11-20',
  };
  const pin: ElementDelta = { kind: 'notice-pin', note };

  it('pins a note with its day and unpins it', () => {
    const pinned = applyElementDelta(calendar(), pin) as ShapeElement;
    expect(pinned.noticeNotes).toEqual([note]);
    const unpinned = applyElementDelta(pinned, {
      kind: 'notice-unpin',
      noteId: 'n1',
      by: 'adder-a',
    }) as ShapeElement;
    expect(unpinned).not.toHaveProperty('noticeNotes');
  });

  it('refuses a note with a day that is not one', () => {
    const el = calendar();
    expect(
      applyElementDelta(el, { kind: 'notice-pin', note: { ...note, day: '2026-02-30' } }),
    ).toBe(el);
  });

  it('takes nothing on a piece that holds no notes', () => {
    const box = calendar({ shape: 'suggestion-box' });
    expect(applyElementDelta(box, pin)).toBe(box);
  });
});
