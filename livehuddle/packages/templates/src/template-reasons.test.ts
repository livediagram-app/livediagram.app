import { describe, expect, it } from 'vitest';
import { notesNewestFirst, onRoomWall, type Element } from '@livehuddle/document';
import { buildTemplate } from './build-template';
import { templateFloors } from './template-floors';
import { pinnedNotes, TEMPLATE_NOTE_AUTHOR, TEMPLATE_NOTE_SIGNER } from './template-notes';
import { TEMPLATES, type TemplateKind } from './templates';

// docs/specs/012-collaboration/virtual-office-template.md "Every room has a reason" (Work Tracker 1076): every Space
// has an arrival, a meeting space with a Door, and a walk-up piece that answers; a Notice Board a template pins notes
// to says how the Space works, signed by no person.

type Shape = Extract<Element, { type: 'shape' }>;
const shapesOf = (kind: TemplateKind): Shape[] =>
  [buildTemplate(kind, 0, 0), ...templateFloors(kind).map((f) => f.build(0, 0))]
    .flat()
    .filter((e): e is Shape => e.type === 'shape');

// The pieces that answer when you walk up to them: a board, a clock, a calendar, a box, a hammock, a window.
const WALK_UPS = new Set([
  'notice-board',
  'world-clock',
  'calendar-wall',
  'suggestion-box',
  'hammock',
  'window',
]);
// A park has no walls: it meets at its bandstand.
const OPEN_AIR = new Set<TemplateKind>(['city-park']);
// The Spaces whose Notice Board comes with notes pinned.
const PINNED: TemplateKind[] = [
  'virtual-office',
  'coworking-space',
  'startup-hq',
  'arcade-lounge',
  'interview-suite',
  'classroom',
  'hackathon-hall',
  'expo-hall',
  'music-hall',
];

const SPACES = TEMPLATES.filter((t) => t.kind !== 'blank-session').map((t) => t.kind);

describe.each(SPACES)('the %s Space', (kind) => {
  const all = shapesOf(kind);

  it('has an Avatar Pad to arrive on', () => {
    expect(all.some((e) => e.shape === 'avatar-pad')).toBe(true);
  });

  it('has a walk-up piece that answers', () => {
    expect(all.some((e) => WALK_UPS.has(e.shape))).toBe(true);
  });

  it.skipIf(OPEN_AIR.has(kind))('meets in a room with a Door', () => {
    const rooms = all.filter((e) => e.shape === 'room');
    const doors = all.filter((e) => e.shape === 'door');
    expect(rooms.some((r) => doors.some((d) => onRoomWall(d, r)))).toBe(true);
  });
});

describe.each(PINNED)('the %s board', (kind) => {
  it('comes with notes pinned by livehuddle, each a title and a body within the limits', () => {
    const boards = shapesOf(kind).filter((e) => e.shape === 'notice-board' && e.noticeNotes);
    expect(boards.length).toBeGreaterThan(0);
    for (const n of boards.flatMap((b) => b.noticeNotes ?? [])) {
      expect(n.author).toBe(TEMPLATE_NOTE_AUTHOR);
      expect(n.by).toBe(TEMPLATE_NOTE_SIGNER);
      expect(n.title!.length).toBeLessThanOrEqual(60);
      expect(n.text.length).toBeLessThanOrEqual(280);
    }
  });
});

it('pins notes oldest first, so the face reads them in the order the template wrote them', () => {
  const notes = pinnedNotes(
    [
      { title: 'First', text: 'a', color: 'yellow' },
      { title: 'Second', text: 'b', color: 'blue' },
    ],
    10_000,
  );
  expect(notes.map((n) => n.at)).toEqual([9_000, 10_000]);
  expect(notesNewestFirst(notes).map((n) => n.title)).toEqual(['First', 'Second']);
  expect(new Set(notes.map((n) => n.id)).size).toBe(2);
});
