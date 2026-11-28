// docs/specs/008-canvas/3d-view.md "A stage stands up": in real 3D a Stage is a raised deck on solid sides, not a tray,
// and a character, and what is placed on it, stands on its deck; two steps up at the front of a wide one.
import { describe, expect, it } from 'vitest';
import { createShape, type Element } from '@livehuddle/document';
import { spaceWalls } from '@/lib/space-3d/space-3d-walls';
import { RISE } from './models/kit';
import { STAGE_DECK, STAGE_STEP, stageSteps } from './models/stage';
import { floorHeightAt, padTops, piecesMesh } from './scene-pieces';
import { wallMesh, wallPalette } from './scene-walls';

const stage = (over: Partial<Element> = {}) =>
  ({ ...createShape('stage', 100, 100), id: 'st', width: 300, height: 150, ...over }) as Element;

describe('a Stage in real 3D', () => {
  it('builds a deck whose top stands at the deck height over its whole box', () => {
    const m = piecesMesh([stage()]);
    const zs = m.positions.filter((_, i) => i % 3 === 2);
    // The plate's lamps and nosing stand a hair proud of the deck; nothing towers over it.
    expect(Math.max(...zs)).toBeGreaterThanOrEqual(STAGE_DECK * RISE - 0.01);
    expect(Math.max(...zs)).toBeLessThan(STAGE_DECK * RISE + 2);
    const b = m.bounds.find((x) => x.id === 'st')!;
    expect(b.z1).toBeCloseTo(Math.max(...zs), 3);
  });

  it('stands its edge lines as nothing: the model is the stage', () => {
    const walls = spaceWalls([stage()]).filter((w) => w.kind === 'stage');
    expect(walls.length).toBeGreaterThan(0);
    const palette = wallPalette(() => '');
    for (const w of walls) expect(wallMesh(w, palette).positions).toHaveLength(0);
  });

  it('raises a character on its deck and on each step, and nowhere else', () => {
    const tops = padTops([stage()]);
    expect(floorHeightAt(tops, 250, 175, 99)).toBeCloseTo(STAGE_DECK * RISE);
    expect(floorHeightAt(tops, 90, 175, 99)).toBe(0);
    const [upper, lower] = stageSteps(300);
    const x = 100 + upper!.x0 + STAGE_STEP.width / 2;
    expect(floorHeightAt(tops, x, 250 + STAGE_STEP.tread / 2, 99)).toBeCloseTo(upper!.z * RISE);
    expect(floorHeightAt(tops, x, 250 + STAGE_STEP.tread * 1.5, 99)).toBeCloseTo(lower!.z * RISE);
    expect(floorHeightAt(tops, x + 100, 250 + STAGE_STEP.tread / 2, 99)).toBe(0);
  });

  it('has no steps when too narrow for them beside its plate', () => {
    expect(stageSteps(120)).toEqual([]);
  });

  it('follows a turned stage', () => {
    const tops = padTops([stage({ rotation: 90 })]);
    // Turned a quarter about its middle (250, 175): 150 across, 300 deep.
    expect(floorHeightAt(tops, 250, 300, 0)).toBeCloseTo(STAGE_DECK * RISE);
    expect(floorHeightAt(tops, 380, 175, 0)).toBe(0);
  });

  it('stands a piece placed on it on its deck', () => {
    const podium = { ...createShape('podium', 230, 120), id: 'p' } as Element;
    const ground = piecesMesh([podium]);
    const raised = piecesMesh([stage(), podium]);
    const lift = (m: ReturnType<typeof piecesMesh>) => m.bounds.find((b) => b.id === 'p')!.z1;
    expect(lift(raised) - lift(ground)).toBeCloseTo(STAGE_DECK * RISE);
  });

  it('keeps an Avatar Pad at its own height', () => {
    const pad = { ...createShape('avatar-pad', 0, 0), id: 'pad' };
    const tops = padTops([pad, stage()]);
    expect(floorHeightAt(tops, pad.x + pad.width / 2, pad.y + pad.height / 2, 7)).toBe(7);
  });
});
