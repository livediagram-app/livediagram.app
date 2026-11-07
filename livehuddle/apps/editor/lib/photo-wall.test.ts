import { describe, expect, it } from 'vitest';
import { listNames, photoName, photoWallFrames, photoWallLabel } from './photo-wall';
import type { WayPerson } from './wayfinding';

// docs/specs/009-elements/team-pieces.md "Team Photo Wall": eight frames at most, seven and a +N past eight.

const person = (i: number, over: Partial<WayPerson> = {}): WayPerson => ({
  id: `p${i}`,
  name: `Person ${i}`,
  color: '#0ea5e9',
  tabId: 't',
  placeId: null,
  ...over,
});
const people = (n: number) => Array.from({ length: n }, (_, i) => person(i));

describe('photoWallFrames', () => {
  it('fills a frame each up to eight', () => {
    expect(photoWallFrames([], 8)).toEqual({ shown: [], rest: [] });
    const eight = people(8);
    expect(photoWallFrames(eight, 8)).toEqual({ shown: eight, rest: [] });
  });

  it('keeps seven and counts the rest past eight', () => {
    const many = people(30);
    const { shown, rest } = photoWallFrames(many, 8);
    expect(shown).toHaveLength(7);
    expect(rest).toHaveLength(23);
    expect(rest[0]!.id).toBe('p7');
  });

  it('never goes below no frames', () => {
    expect(photoWallFrames(people(2), 0)).toEqual({ shown: [], rest: people(2) });
  });
});

describe('the wall’s words', () => {
  it('names you, and someone with no name', () => {
    expect(photoName(person(1, { name: 'Sam', self: true }))).toBe('Sam (you)');
    expect(photoName(person(1, { name: '  ' }))).toBe('Someone');
  });

  it('lists names as a sentence', () => {
    expect(listNames([])).toBe('');
    expect(listNames(['Sam'])).toBe('Sam');
    expect(listNames(['Sam', 'Jo'])).toBe('Sam and Jo');
    expect(listNames(['Sam', 'Priya', 'Jo'])).toBe('Sam, Priya and Jo');
  });

  it('labels the wall for a screen reader', () => {
    expect(
      photoWallLabel([
        person(0, { name: 'Sam', self: true }),
        person(1, { name: 'Priya' }),
        person(2, { name: 'Jo' }),
      ]),
    ).toBe('Team photo wall: Sam (you), Priya and Jo');
    expect(photoWallLabel([])).toBe('Team photo wall, empty frames');
  });
});
