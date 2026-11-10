import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import { HEARING_RADIUS_PX } from './hearing';
import { hearingRing, zoneOutline } from './hearing-ring';
import { callStages } from './stage';
import { roomZones } from './zones';
import { speakingStageId } from '@/components/canvas/collab/speaking-stage';

// docs/specs/012-collaboration/proximity-audio.md "Your hearing ring": a hall with a meeting room inside it, a room
// across the corridor, a Room Builder room, and a stage along the hall's back.
const room = (id: string, x: number, y: number, width: number, height: number, over = {}) => ({
  id,
  type: 'shape',
  shape: 'room',
  x,
  y,
  width,
  height,
  ...over,
});
const zones = roomZones([
  room('hall', 0, 0, 1200, 800),
  room('meeting', 800, 400, 300, 300),
  room('across', 0, 1000, 400, 300),
  room('far', 5000, 5000, 400, 300),
]);
const stages = callStages(
  [
    {
      id: 'stage',
      type: 'shape',
      shape: 'stage',
      x: 420,
      y: 40,
      width: 360,
      height: 140,
      stageSpeakers: 'take-part',
    },
  ],
  zones,
);
const onStage = { x: 600, y: 120 };

describe('hearingRing', () => {
  it('is the whole circle on the open floor, far from every room', () => {
    expect(hearingRing({ x: 3000, y: 3000 }, zones)).toEqual({
      cx: 3000,
      cy: 3000,
      r: HEARING_RADIUS_PX,
      clip: null,
      holes: [],
    });
    expect(hearingRing({ x: 3000, y: 3000 }, [])).toMatchObject({ clip: null, holes: [] });
  });

  // venue-pieces.md "Speaking from the Podium": three times as far from a Podium, still cut by every wall.
  it('reaches three times as far from a podium, cut to your room as ever', () => {
    const far = hearingRing({ x: 3000, y: 3000, seatedOn: 'podium', reach: 3 }, zones)!;
    expect(far.r).toBe(3 * HEARING_RADIUS_PX);
    // Inside the hall at a podium: cut to the hall; the meeting room inside it, and now the room across the corridor
    // (in reach at three times the radius), are holes.
    const ring = hearingRing({ x: 300, y: 500, seatedOn: 'podium', reach: 3 }, zones)!;
    const byId = (id: string) => zoneOutline(zones.find((z) => z.id === id)!);
    expect(ring.r).toBe(3 * HEARING_RADIUS_PX);
    expect(ring.clip).toEqual(byId('hall'));
    expect(ring.holes).toEqual([byId('meeting'), byId('across')]);
    // Off the podium neither is in reach.
    expect(hearingRing({ x: 300, y: 500 }, zones)!.holes).toEqual([]);
  });

  it('cuts out a room you stand outside of, as walls block sound both ways', () => {
    const ring = hearingRing({ x: 200, y: 900 }, zones)!;
    expect(ring.clip).toBeNull();
    // The hall above and the room across, both within reach; the far room is not.
    const hall = zones.find((z) => z.id === 'hall')!;
    const across = zones.find((z) => z.id === 'across')!;
    expect(ring.holes).toEqual([zoneOutline(hall), zoneOutline(across)]);
  });

  it('is cut to your room inside one, less any room inside it', () => {
    const ring = hearingRing({ x: 700, y: 500 }, zones)!;
    const hall = zones.find((z) => z.id === 'hall')!;
    const meeting = zones.find((z) => z.id === 'meeting')!;
    expect(ring.clip).toEqual(zoneOutline(hall));
    expect(ring.holes).toEqual([zoneOutline(meeting)]);
    // Inside the meeting room: cut to it, and the hall round it is not a hole.
    const inner = hearingRing({ x: 950, y: 550 }, zones)!;
    expect(inner.clip).toEqual(zoneOutline(meeting));
    expect(inner.holes).toEqual([]);
  });

  it('follows a Room Builder outline', () => {
    const shaped = roomZones([
      room('l', 0, 0, 400, 400, {
        roomOutline: [
          { x: 0, y: 0 },
          { x: 1, y: 0 },
          { x: 1, y: 0.5 },
          { x: 0.5, y: 0.5 },
          { x: 0.5, y: 1 },
          { x: 0, y: 1 },
        ],
      }),
    ]);
    expect(hearingRing({ x: 100, y: 100 }, shaped)!.clip).toEqual(shaped[0]!.polygon);
    // In the L's missing corner you are outside it: the L is a hole.
    expect(hearingRing({ x: 300, y: 300 }, shaped)!.holes).toEqual([shaped[0]!.polygon]);
  });

  it('is gone on a stage that lets you speak, and kept on one that does not', () => {
    expect(hearingRing(onStage, zones, stages, 'edit')).toBeNull();
    expect(hearingRing(onStage, zones, stages, 'participate')).toBeNull();
    const editorsOnly = stages.map((s) => ({ ...s, speakers: 'edit' as const }));
    expect(hearingRing(onStage, zones, editorsOnly, 'participate')).not.toBeNull();
    expect(hearingRing(onStage, zones, stages, 'view')).not.toBeNull();
    expect(hearingRing({ x: 700, y: 500 }, zones, stages, 'edit')).not.toBeNull();
  });

  it('stays cheap with many rooms on the board', () => {
    const many = roomZones(
      Array.from({ length: 500 }, (_, i) =>
        room(`r${i}`, (i % 25) * 300, Math.floor(i / 25) * 300, 250, 250),
      ),
    );
    const ms = cpuMsOf(() => {
      for (let i = 0; i < 100; i++) hearingRing({ x: 1000 + i, y: 1000 }, many);
    });
    // 100 steps of talking over 500 rooms.
    expect(ms).toBeLessThan(cpuBudgetMs(50));
  });
});

describe('speakingStageId', () => {
  it('names the stage you may speak from, else null', () => {
    expect(speakingStageId(onStage, stages, 'participate')).toBe('stage');
    expect(speakingStageId(onStage, stages, 'view')).toBeNull();
    expect(speakingStageId({ x: 700, y: 500 }, stages, 'edit')).toBeNull();
    expect(speakingStageId(null, stages, 'edit')).toBeNull();
    expect(speakingStageId(onStage, [], 'edit')).toBeNull();
  });
});
