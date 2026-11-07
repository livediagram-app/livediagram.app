import { describe, expect, it } from 'vitest';
import { isGlassRoom, onRoomWall, type Element } from '@livehuddle/document';
import { buildTemplate } from './build-template';
import { templateFirstFloorName, templateFloors } from './template-floors';
import { templateCanvasOverrides } from './template-canvas-overrides';
import type { TemplateKind } from './templates';

// docs/specs/012-collaboration/virtual-office-template.md "Homes", "Games Rooms" and "Venues" (Work Tracker #641): the
// houses' floors and their Stairs, the windows and glass walls, and what each new Space promises.

type Shape = Extract<Element, { type: 'shape' }>;
const shapes = (els: readonly Element[]) => els.filter((e): e is Shape => e.type === 'shape');
const count = (els: readonly Shape[], kind: string) => els.filter((e) => e.shape === kind).length;

const HOMES: Record<string, readonly string[]> = {
  'family-house': ['Downstairs', 'Upstairs'],
  'city-townhouse': ['Downstairs', 'Upstairs', 'Roof Terrace'],
  'country-cottage': ['Downstairs', 'Upstairs'],
};

/** Every floor of a template, the first buildTemplate's, each built round (0, 0). */
const floorsOf = (kind: TemplateKind): Shape[][] => [
  shapes(buildTemplate(kind, 0, 0)),
  ...templateFloors(kind).map((f) => shapes(f.build(0, 0))),
];

describe.each(Object.entries(HOMES))('the %s', (key, names) => {
  const kind = key as TemplateKind;
  const floors = floorsOf(kind);

  it('has its floors as tabs named Downstairs, Upstairs and on, each its own floor pattern', () => {
    expect([templateFirstFloorName(kind), ...templateFloors(kind).map((f) => f.name)]).toEqual(
      names,
    );
    expect(templateCanvasOverrides(kind).backgroundPattern).toBeDefined();
    const patterns = templateFloors(kind).map((f) => f.floor);
    expect(new Set([templateCanvasOverrides(kind).backgroundPattern, ...patterns]).size).toBe(
      names.length,
    );
  });

  it('stands one flight of Stairs at the same canvas point on every floor, and no Elevator or Directory', () => {
    const spots = floors.map((els) => {
      const stairs = els.filter((e) => e.shape === 'stairs');
      expect(stairs).toHaveLength(1);
      return `${stairs[0]!.x},${stairs[0]!.y}`;
    });
    expect(new Set(spots).size).toBe(1);
    for (const els of floors) {
      expect(count(els, 'elevator')).toBe(0);
      expect(count(els, 'directory')).toBe(0);
      expect(count(els, 'room-sign')).toBe(0);
    }
  });

  it('stands every window on a room’s wall, and gives every indoor floor some', () => {
    for (const els of floors) {
      const rooms = els.filter((e) => e.shape === 'room');
      const windows = els.filter((e) => e.shape === 'window');
      for (const w of windows)
        expect(
          rooms.some((r) => onRoomWall(w, r)),
          `window at ${w.x},${w.y}`,
        ).toBe(true);
      if (rooms.length > 0) expect(windows.length).toBeGreaterThanOrEqual(rooms.length);
    }
  });
});

describe('what the new Spaces furnish', () => {
  it('gives the Arcade Lounge twenty Arcade Machines, a glass Party Room, a Vending Machine and Bean Bags', () => {
    const [els] = floorsOf('arcade-lounge');
    expect(count(els!, 'arcade-machine')).toBe(20);
    expect(count(els!, 'vending-machine')).toBe(1);
    expect(count(els!, 'bean-bag')).toBe(3);
    const glass = els!.filter((e) => e.shape === 'room' && isGlassRoom(e)).map((r) => r.label);
    expect(glass).toEqual(['Party Room']);
  });

  it('gives the Games Night Den a fire with the Pet Bed, pool, foosball, darts and windows', () => {
    const [els] = floorsOf('games-night-den');
    for (const kind of ['fireplace', 'pet-bed', 'pool-table', 'foosball-table', 'dartboard'])
      expect(count(els!, kind), kind).toBe(1);
    expect(count(els!, 'window')).toBeGreaterThanOrEqual(3);
  });

  it('gives the Sports Bar two Ping-Pong Tables, pool, foosball, darts and a glass Screen Lounge', () => {
    const [els] = floorsOf('sports-bar');
    expect(count(els!, 'ping-pong-table')).toBe(2);
    expect(count(els!, 'pool-table')).toBe(1);
    expect(count(els!, 'foosball-table')).toBe(1);
    expect(count(els!, 'dartboard')).toBe(1);
    expect(count(els!, 'screen')).toBe(2);
    const glass = els!.filter((e) => e.shape === 'room' && isGlassRoom(e)).map((r) => r.label);
    expect(glass).toEqual(['Screen Lounge']);
  });

  it('gives each house a Pet Bed, and the City Townhouse a glass Home Office and an open-air roof', () => {
    for (const kind of Object.keys(HOMES) as TemplateKind[])
      expect(
        floorsOf(kind)
          .flat()
          .filter((e) => e.shape === 'pet-bed'),
        kind,
      ).toHaveLength(1);
    const [, upstairs, roof] = floorsOf('city-townhouse');
    const glass = upstairs!.filter((e) => e.shape === 'room' && isGlassRoom(e)).map((r) => r.label);
    expect(glass).toEqual(['Home Office']);
    expect(count(roof!, 'room')).toBe(0);
    expect(count(roof!, 'grass')).toBe(1);
  });

  it('gives the Music Hall a curtained Stage, twenty chairs and a Foyer Bar, Green Room and Cloakroom', () => {
    const [els] = floorsOf('music-hall');
    expect(count(els!, 'stage')).toBe(1);
    expect(count(els!, 'stage-curtains')).toBe(1);
    expect(count(els!, 'chair')).toBeGreaterThanOrEqual(20);
    expect(count(els!, 'focus-button')).toBe(1);
    const rooms = els!.filter((e) => e.shape === 'room').map((r) => r.label);
    expect(rooms).toEqual(['Main Hall', 'Foyer Bar', 'Green Room', 'Cloakroom']);
  });
});
