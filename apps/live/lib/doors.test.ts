import { describe, expect, it } from 'vitest';
import { createShape, type Element, type ShapeElement } from '@livediagram/diagram';
import {
  doorExitPoint,
  doorName,
  doorsOnTab,
  resolveDoorTarget,
  viewportOffsetCentredOn,
} from './doors';

const door = (id: string, over: Partial<ShapeElement> = {}): ShapeElement => ({
  ...createShape('door', 0, 0),
  id,
  ...over,
});

describe('doorsOnTab', () => {
  it('picks out the doors and nothing else, in element order', () => {
    const els: Element[] = [
      createShape('square', 0, 0),
      door('a'),
      createShape('mode-button', 0, 0),
      door('b'),
    ];
    expect(doorsOnTab(els).map((d) => d.id)).toEqual(['a', 'b']);
  });
});

describe('doorName', () => {
  it('uses the door’s own label when it has one', () => {
    const els = [door('a', { label: 'Kitchen' })];
    expect(doorName(els, els[0]!)).toBe('Kitchen');
  });

  it('falls back to a positional name so an unlabelled pair is tellable apart', () => {
    const els = [door('a', { label: '   ' }), door('b', { label: '' })];
    expect(doorName(els, els[0]!)).toBe('Door 1');
    expect(doorName(els, els[1]!)).toBe('Door 2');
  });
});

describe('resolveDoorTarget', () => {
  it('finds the paired door', () => {
    const els = [door('a', { doorTarget: 'b' }), door('b')];
    expect(resolveDoorTarget(els, els[0]!)?.id).toBe('b');
  });

  it('treats an unpaired door as unpaired', () => {
    const els = [door('a')];
    expect(resolveDoorTarget(els, els[0]!)).toBeNull();
  });

  it('survives a deleted target (a normal mid-edit state, not corruption)', () => {
    const els = [door('a', { doorTarget: 'gone' })];
    expect(resolveDoorTarget(els, els[0]!)).toBeNull();
  });

  it('refuses a target that is not a door any more', () => {
    const els: Element[] = [
      door('a', { doorTarget: 'b' }),
      { ...createShape('square', 0, 0), id: 'b' },
    ];
    expect(resolveDoorTarget(els, els[0]! as ShapeElement)).toBeNull();
  });

  it('refuses to pair a door with itself', () => {
    const els = [door('a', { doorTarget: 'a' })];
    expect(resolveDoorTarget(els, els[0]!)).toBeNull();
  });
});

describe('doorExitPoint', () => {
  it('puts you centred in the doorway, on its threshold', () => {
    // The avatar's position is its FEET, so the exit is the bottom edge.
    expect(doorExitPoint({ x: 100, y: 200, width: 72, height: 112 })).toEqual({
      x: 136,
      y: 312,
    });
  });
});

describe('viewportOffsetCentredOn', () => {
  it('centres the door in the viewport', () => {
    const offset = viewportOffsetCentredOn(
      { x: 500, y: 300, width: 100, height: 100 },
      { width: 1000, height: 800 },
      1,
    );
    // Door centre (550, 350) lands at the viewport centre (500, 400).
    expect(offset).toEqual({ x: -50, y: 50 });
  });

  it('accounts for zoom, since the offset is applied before the scale', () => {
    const offset = viewportOffsetCentredOn(
      { x: 0, y: 0, width: 100, height: 100 },
      { width: 1000, height: 800 },
      2,
    );
    expect(offset).toEqual({ x: 200, y: 150 });
  });
});
