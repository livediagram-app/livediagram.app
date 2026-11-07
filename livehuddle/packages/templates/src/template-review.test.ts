import { describe, expect, it } from 'vitest';
import { isGlassRoom, onRoomWall, type Element } from '@livehuddle/document';
import { buildTemplate } from './build-template';
import { templateFloors } from './template-floors';
import { templateCategory } from './template-categories';
import { TEMPLATES, type TemplateKind } from './templates';

// docs/specs/012-collaboration/virtual-office-template.md "The review of the existing Spaces" (Work Tracker #641, part
// 2): the newer pieces each of the eighteen earlier Spaces gained, Space by Space, and the windows every Space stands in
// its rooms' walls.

type Shape = Extract<Element, { type: 'shape' }>;
const shapes = (els: readonly Element[]) => els.filter((e): e is Shape => e.type === 'shape');

/** Every floor of a template, its first and then a building's others, each built round (0, 0). */
const floorsOf = (kind: TemplateKind): Shape[][] => [
  shapes(buildTemplate(kind, 0, 0)),
  ...templateFloors(kind).map((f) => shapes(f.build(0, 0))),
];
const allOf = (kind: TemplateKind) => floorsOf(kind).flat();
const count = (els: readonly Shape[], kind: string) => els.filter((e) => e.shape === kind).length;
const roomNamed = (els: readonly Shape[], name: string) =>
  els.find((e) => e.shape === 'room' && e.label === name);
const inside = (p: Shape, r: Shape) =>
  p.x >= r.x && p.y >= r.y && p.x + p.width <= r.x + r.width && p.y + p.height <= r.y + r.height;

// What each Space gained: the pieces it now has at least one of, the glass rooms, and whether its rooms have windows.
const REVIEW: Record<string, { pieces?: string[]; glass?: string[]; windows: boolean }> = {
  'virtual-office': { pieces: ['pet-bed'], glass: ['Meeting Room'], windows: true },
  'coworking-space': { pieces: ['lockers'], glass: ['Booth 1', 'Booth 2'], windows: true },
  'team-pod': { pieces: ['pet-bed'], windows: true },
  'focus-library': { pieces: ['reading-nook'], windows: true },
  'all-hands-hall': { windows: true },
  'training-room': { windows: true },
  'expo-hall': {
    pieces: ['photo-wall', 'vending-machine', 'lockers', 'coat-rack', 'umbrella-stand'],
    windows: false,
  },
  'company-campus': { pieces: ['pet-bed'], windows: true },
  'startup-hq': { pieces: ['dartboard', 'pet-bed'], windows: true },
  'school-quad': { pieces: ['bean-bag'], windows: true },
  'coworking-tower': {
    pieces: ['vending-machine', 'ping-pong-table', 'foosball-table', 'dartboard', 'stairs'],
    windows: true,
  },
  'garden-retreat': { pieces: ['pet-bed'], windows: true },
  'city-park': { pieces: ['ping-pong-table'], windows: false },
  'beach-offsite': { pieces: ['ping-pong-table'], windows: true },
  'rooftop-bar': { windows: false },
  cafe: { pieces: ['pet-bed'], windows: true },
  'conference-venue': { pieces: ['coat-rack', 'umbrella-stand'], windows: true },
  'hotel-and-suites': { pieces: ['stairs', 'ping-pong-table'], windows: true },
};

it('reviews all eighteen earlier Spaces', () => {
  expect(Object.keys(REVIEW)).toHaveLength(18);
  for (const kind of Object.keys(REVIEW))
    expect(templateCategory(kind as TemplateKind), kind).not.toBeNull();
});

describe.each(Object.entries(REVIEW))('the reviewed %s', (key, review) => {
  const kind = key as TemplateKind;
  const els = allOf(kind);

  it('has the newer pieces it gained', () => {
    for (const piece of review.pieces ?? []) expect(count(els, piece), piece).toBeGreaterThan(0);
  });

  it('walls its glass rooms in glass, each with a sliding glass Door', () => {
    for (const name of review.glass ?? []) {
      const room = roomNamed(els, name)!;
      expect(isGlassRoom(room), name).toBe(true);
      const door = els.find((e) => e.shape === 'door' && onRoomWall(e, room));
      expect(door?.variant, name).toBe('sliding');
    }
  });

  it('stands windows in its rooms’ walls where it has walls to the outside', () => {
    expect(count(els, 'window') > 0).toBe(review.windows);
  });
});

describe.each(TEMPLATES.map((t) => t.kind).filter((k) => templateCategory(k) !== null))(
  'the %s windows',
  (kind) => {
    it('stand on a room’s wall, never loose on the floor', () => {
      for (const floor of floorsOf(kind)) {
        const rooms = floor.filter((e) => e.shape === 'room');
        for (const w of floor.filter((e) => e.shape === 'window'))
          expect(
            rooms.some((r) => onRoomWall(w, r)),
            `window at ${w.x},${w.y}`,
          ).toBe(true);
      }
    });
  },
);

describe('the Pet Beds and games in the reviewed Spaces', () => {
  it('lays the Virtual Office’s Pet Bed in its Lounge and the Company Campus’s by the Games Room fire', () => {
    const office = allOf('virtual-office');
    const bed = office.find((e) => e.shape === 'pet-bed')!;
    expect(inside(bed, roomNamed(office, 'Lounge')!)).toBe(true);
    const campus = allOf('company-campus');
    const games = roomNamed(campus, 'Games Room')!;
    const fire = campus.find((e) => e.shape === 'fireplace' && inside(e, games))!;
    const campusBed = campus.find((e) => e.shape === 'pet-bed')!;
    expect(inside(campusBed, games)).toBe(true);
    expect(campusBed.y - (fire.y + fire.height)).toBeLessThan(24);
  });

  it('gives the Co-working Tower’s Level 3 a games corner and its Roof Bar a Dartboard', () => {
    const level3 = shapes(templateFloors('coworking-tower')[1]!.build(0, 0));
    expect(count(level3, 'ping-pong-table')).toBe(1);
    expect(count(level3, 'foosball-table')).toBe(1);
    const bar = roomNamed(level3, 'Roof Bar')!;
    expect(level3.some((e) => e.shape === 'dartboard' && inside(e, bar))).toBe(true);
  });

  it('gives every Hotel and Suites suite a window', () => {
    const suites = shapes(templateFloors('hotel-and-suites')[0]!.build(0, 0));
    const rooms = suites.filter((e) => e.shape === 'room');
    expect(rooms).toHaveLength(6);
    for (const r of rooms)
      expect(
        suites.some((e) => e.shape === 'window' && onRoomWall(e, r)),
        r.label,
      ).toBe(true);
  });
});
