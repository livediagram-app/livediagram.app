import { describe, expect, it } from 'vitest';
import { cpuBudgetMs, cpuMsOf } from '@liveworkspace/vitest-config/cpu-time';
import type { AccessLevel } from '@livehuddle/api-schema';
import { STAGE_FRONT } from '@livehuddle/document';
import {
  inEarshot,
  MAX_PAN,
  nextHeard,
  placeFor,
  someoneHears,
  togetherWith,
  type Point,
} from './hearing';
import { callStages, mayTakeStage, stageAt, staging, type CallStage } from './stage';
import { roomZones, zoning, type CallZone, type CallZoning } from './zones';

// docs/specs/012-collaboration/meeting-rooms-and-stage.md "The stage" (Work Tracker #319 part 2). An all-hands hall
// (a room 1200 × 800) with a stage along its back, a corridor below it, and a meeting room beside it.
const room = (id: string, x: number, y: number, width: number, height: number) => ({
  id,
  type: 'shape',
  shape: 'room',
  x,
  y,
  width,
  height,
});
const stage = (id: string, x: number, y: number, over: Record<string, unknown> = {}) => ({
  id,
  type: 'shape',
  shape: 'stage',
  x,
  y,
  width: 360,
  height: 140,
  ...over,
});

const zones = roomZones([room('hall', 0, 0, 1200, 800), room('meeting', 1300, 0, 400, 300)]);
const onStage = { x: 600, y: 120 };
const front = { x: 640, y: 120 };
const corridor = (x: number): Point => ({ x, y: 900 });

type Who = [string, Point, AccessLevel?][];

function scene(
  self: Point | null,
  others: Who,
  opts: {
    selfLevel?: AccessLevel;
    stages?: readonly CallStage[];
    zones?: readonly CallZone[];
  } = {},
) {
  const z = opts.zones ?? zones;
  const stages = opts.stages ?? callStages([stage('stage', 420, 40)], z);
  const walkers = new Map(others.map(([id, at]) => [id, at] as const));
  const levels = new Map(others.map(([id, , level]) => [id, level ?? 'participate'] as const));
  const zoned = zoning(self, walkers, z);
  const staged = staging(self, opts.selfLevel ?? 'participate', walkers, levels, stages);
  const zoningOut: CallZoning = staged ? { ...zoned, stage: staged } : zoned;
  return {
    zoning: zoningOut,
    walkers,
    heard: [...nextHeard(new Set(), self, walkers, zoningOut)].sort(),
  };
}

describe('callStages', () => {
  it('reads each visible stage’s top, the room it stands in, and its settings through their defaults', () => {
    const stages = callStages(
      [
        stage('a', 420, 40),
        stage('b', 2000, 40, { stageSpeakers: 'take-part', stageCameras: true }),
        stage('c', 0, 0, { stageSpeakers: 'everyone', stageCameras: 'yes' }),
        room('r', 0, 0, 10, 10),
        { id: 'x', type: 'text', x: 0, y: 0, width: 10, height: 10 },
      ],
      zones,
    );
    expect(stages.map((s) => s.id)).toEqual(['a', 'b', 'c']);
    expect(stages[0]).toEqual({
      id: 'a',
      x0: 420,
      y0: 40,
      x1: 780,
      y1: 40 + 140 - STAGE_FRONT,
      area: 360 * (140 - STAGE_FRONT),
      zone: 'hall',
      speakers: 'edit',
      cameras: false,
    });
    expect(stages[1]).toMatchObject({ zone: null, speakers: 'take-part', cameras: true });
    expect(stages[2]).toMatchObject({ speakers: 'edit', cameras: false });
  });

  it('skips a stage with no box, or too short to stand on', () => {
    expect(
      callStages(
        [
          { id: 'nobox', type: 'shape', shape: 'stage' },
          stage('flat', 0, 0, { height: STAGE_FRONT }),
        ],
        zones,
      ),
    ).toEqual([]);
  });
});

describe('stageAt', () => {
  const stages = callStages(
    [stage('big', 0, 0, { width: 600 }), stage('small', 100, 0), stage('twin', 100, 0)],
    [],
  );
  it('holds feet strictly on the top: never on the front edge or the outline', () => {
    expect(stageAt({ x: 50, y: 50 }, stages)?.id).toBe('big');
    expect(stageAt({ x: 50, y: 140 - STAGE_FRONT }, stages)).toBeNull();
    expect(stageAt({ x: 50, y: 130 }, stages)).toBeNull();
    expect(stageAt({ x: 0, y: 50 }, stages)).toBeNull();
  });

  it('picks the smallest of overlapping stages, then the lower id', () => {
    expect(stageAt({ x: 200, y: 50 }, stages)?.id).toBe('small');
  });
});

describe('mayTakeStage', () => {
  it('lets Editors speak, and Participants only where the stage says so; a Viewer never', () => {
    expect(mayTakeStage('edit', 'edit')).toBe(true);
    expect(mayTakeStage('participate', 'edit')).toBe(false);
    expect(mayTakeStage('participate', 'take-part')).toBe(true);
    expect(mayTakeStage('view', 'take-part')).toBe(false);
    expect(mayTakeStage(undefined, 'take-part')).toBe(false);
  });
});

describe('the stage', () => {
  const open = callStages([stage('stage', 420, 40, { stageSpeakers: 'take-part' })], zones);

  it('reaches every walker on the tab: the hall, the corridor and the meeting room, full and centred', () => {
    const editor: Who = [['speaker', onStage, 'edit']];
    for (const listener of [{ x: 100, y: 700 }, corridor(100), { x: 1500, y: 200 }]) {
      const { heard, zoning: z } = scene(listener, editor);
      expect(heard).toEqual(['speaker']);
      expect(togetherWith('speaker', z)).toBe('stage');
      expect(placeFor(listener, onStage, 'stage')).toEqual({ gain: 1, pan: 0 });
    }
  });

  it('is only a stage for someone it lets speak: anyone else on it is the audience', () => {
    // A Participant on an Editors' stage, heard as the hall is: by distance, and not from the corridor.
    const { heard, zoning: z } = scene(corridor(100), [['p', onStage, 'participate']]);
    expect(heard).toEqual([]);
    expect(z.stage).toBeUndefined();
    // The same Participant on a stage that takes part.
    expect(scene(corridor(100), [['p', onStage, 'participate']], { stages: open }).heard).toEqual([
      'p',
    ]);
    // A Viewer, never.
    expect(
      scene(corridor(100), [['v', onStage, 'view']], { stages: open }).zoning.stage,
    ).toBeUndefined();
  });

  it('turns the hall into an audience that whispers by distance, never heard by the stage', () => {
    const near = { x: 100, y: 700 };
    const others: Who = [
      ['speaker', onStage, 'edit'],
      ['neighbour', { x: 300, y: 700 }],
      ['far', { x: 1100, y: 700 }],
    ];
    const { heard, zoning: z } = scene(near, others);
    expect(heard).toEqual(['neighbour', 'speaker']);
    expect(togetherWith('neighbour', z)).toBe('open');
    expect(togetherWith('far', z)).toBe('open');
    // Without the stage, the hall is one room: the far corner heard too.
    expect(scene(near, others.slice(1)).heard).toEqual(['far', 'neighbour']);
    // The stage hears none of them, and they do not hear their voice reach it.
    expect(inEarshot(near, onStage, 'stage')).toBe(false);
    const speaker = scene(onStage, others.slice(1), { selfLevel: 'edit' });
    expect(speaker.heard).toEqual([]);
    expect(togetherWith('neighbour', speaker.zoning)).toBe('apart');
  });

  it('keeps the walls: the hall’s audience never hears the corridor, and the meeting room keeps its call', () => {
    const others: Who = [
      ['speaker', onStage, 'edit'],
      ['passer-by', { x: 100, y: 820 }],
      ['in the meeting', { x: 1600, y: 250 }],
    ];
    expect(scene({ x: 100, y: 760 }, others).heard).toEqual(['speaker']);
    // In the meeting room: the stage and the meeting, from its far corner, as a room.
    const meeting = scene({ x: 1320, y: 50 }, others);
    expect(meeting.heard).toEqual(['in the meeting', 'speaker']);
    expect(togetherWith('in the meeting', meeting.zoning)).toBe('room');
  });

  it('lets speakers hear each other as one room, panned by side, and anyone on the tab hear them', () => {
    const { heard, zoning: z } = scene(onStage, [['co-speaker', front, 'edit']], {
      selfLevel: 'edit',
    });
    expect(heard).toEqual(['co-speaker']);
    expect(togetherWith('co-speaker', z)).toBe('room');
    expect(placeFor(onStage, { x: onStage.x + 300, y: onStage.y }, 'room')).toEqual({
      gain: 1,
      pan: MAX_PAN,
    });
    expect(z.stage?.self).toBe(true);
    // Live while anyone walks the tab, even in another room.
    expect(someoneHears(onStage, new Map([['far away', { x: 1500, y: 200 }]]), z)).toBe(true);
    expect(someoneHears(onStage, new Map(), z)).toBe(false);
  });

  it('makes a stage in the open the whole floor’s, and leaves every room its own call', () => {
    const outdoor = callStages([stage('lawn', 2000, 1000)], zones);
    const lawn = { x: 2100, y: 1050 };
    const others: Who = [
      ['speaker', lawn, 'edit'],
      ['on the floor', corridor(150)],
      ['in the hall', { x: 1100, y: 700 }],
    ];
    const hall = scene({ x: 100, y: 700 }, others, { stages: outdoor });
    expect(hall.heard).toEqual(['in the hall', 'speaker']);
    expect(togetherWith('in the hall', hall.zoning)).toBe('room');
    expect(hall.zoning.stage?.audience.size).toBe(0);
    expect(scene(corridor(0), others, { stages: outdoor }).heard).toEqual([
      'on the floor',
      'speaker',
    ]);
  });

  it('counts two stages as one for hearing: every speaker reaches the tab and the others', () => {
    const two = callStages([stage('a', 420, 40), stage('b', 2000, 1000)], zones);
    const { heard } = scene(onStage, [['other stage', { x: 2100, y: 1050 }, 'edit']], {
      stages: two,
      selfLevel: 'edit',
    });
    expect(heard).toEqual(['other stage']);
  });

  it('hides a speaker’s bubbles from the audience unless the stage shows cameras', () => {
    const hidden = scene(corridor(0), [['speaker', onStage, 'edit']]);
    expect([...(hidden.zoning.stage?.unseen ?? [])]).toEqual(['speaker']);
    const shown = scene(corridor(0), [['speaker', onStage, 'edit']], {
      stages: callStages([stage('stage', 420, 40, { stageCameras: true })], zones),
    });
    expect(shown.zoning.stage?.unseen.size).toBe(0);
  });

  it('has no staging with no stages, or nobody on them, or nobody placed', () => {
    expect(scene(onStage, [], { stages: [] }).zoning.stage).toBeUndefined();
    expect(scene({ x: 100, y: 700 }, [['p', { x: 300, y: 700 }]]).zoning.stage).toBeUndefined();
    expect(scene(null, [], { selfLevel: 'edit' }).zoning.stage).toBeUndefined();
    expect(someoneHears(null, new Map(), undefined)).toBe(false);
  });

  it('stages and hears 100 walkers among 50 rooms with a live stage within a frame’s budget', () => {
    const rooms = Array.from({ length: 50 }, (_, i) => room(`r${i}`, i * 600, 0, 600, 400));
    const many = roomZones(rooms);
    const stages = callStages([stage('s', 100, 40)], many);
    const walkers = new Map<string, Point>(
      Array.from({ length: 100 }, (_, i) => [`p${i}`, { x: i * 300 + 50, y: 200 }] as const),
    );
    walkers.set('speaker', { x: 200, y: 100 });
    const levels = new Map<string, AccessLevel>([['speaker', 'edit']]);
    const self = { x: 60, y: 300 };
    let heard: ReadonlySet<string> = new Set();
    const best = Math.min(
      ...Array.from({ length: 5 }, () =>
        cpuMsOf(() => {
          for (let i = 0; i < 60; i++) {
            const z = zoning(self, walkers, many);
            const s = staging(self, 'participate', walkers, levels, stages);
            heard = nextHeard(heard, self, walkers, s ? { ...z, stage: s } : z);
          }
        }),
      ),
    );
    expect([...heard].sort()).toEqual(['p0', 'speaker']);
    // 60 scenes, a second of walking: well under a frame each.
    expect(best).toBeLessThan(cpuBudgetMs(30));
  });
});
