// Where calls happen on a tab (docs/specs/012-collaboration/meeting-rooms-and-stage.md "Rooms are calls", "The
// stage"): the geometry the editor's call and the api's hearing check share.
import { describe, expect, it } from 'vitest';
import { callStages, mayTakeStage, roomZones, stageAt, zoneAt } from './call-geometry';

const room = (id: string, x: number, y: number, width: number, height: number) => ({
  id,
  type: 'shape',
  shape: 'room',
  x,
  y,
  width,
  height,
});

describe('call geometry', () => {
  it('reads every placed room, skipping other shapes, unplaced ones and rooms too small to stand in', () => {
    const zones = roomZones([
      room('big', 0, 0, 800, 600),
      room('booth', 100, 200, 200, 200),
      { ...room('half', 0, 0, 100, 100), x: undefined },
      room('tiny', 0, 0, 4, 4),
      { id: 'sticky', type: 'sticky', x: 0, y: 0, width: 100, height: 100 },
    ]);
    expect(zones.map((z) => z.id)).toEqual(['big', 'booth']);
    // The innermost room holds you; the open floor is null.
    expect(zoneAt({ x: 200, y: 300 }, zones)).toBe('booth');
    expect(zoneAt({ x: 600, y: 500 }, zones)).toBe('big');
    expect(zoneAt({ x: 2000, y: 2000 }, zones)).toBeNull();
  });

  // docs/specs/009-elements/workday-pieces.md "Phone Booth": a call for one, the innermost in its room.
  it('reads a phone booth as a call of its own, its seat inside it, the floor beside it the room', () => {
    const booth = { ...room('phone', 300, 200, 80, 136), shape: 'phone-booth' };
    const zones = roomZones([room('open-plan', 0, 0, 800, 600), booth]);
    expect(zones.map((z) => z.id)).toEqual(['open-plan', 'phone']);
    // Its seat (seats.ts PHONE_BOOTH_SEATS: 0.5, 112/136) is in the booth's call; a step outside is the room's.
    expect(zoneAt({ x: 340, y: 312 }, zones)).toBe('phone');
    expect(zoneAt({ x: 420, y: 312 }, zones)).toBe('open-plan');
    // Its roof is outside its call.
    expect(zoneAt({ x: 340, y: 220 }, zones)).toBe('open-plan');
  });

  it('reads stages with their room and settings, and who may speak from them', () => {
    const zones = roomZones([room('hall', 0, 0, 2000, 1000)]);
    const stage = (id: string, extra: object = {}) => ({
      id,
      type: 'shape',
      shape: 'stage',
      x: 500,
      y: 400,
      width: 360,
      height: 140,
      ...extra,
    });
    const stages = callStages(
      [
        stage('a'),
        stage('b', { stageSpeakers: 'take-part', stageCameras: true, x: 5000 }),
        stage('flat', { height: 0 }),
        { ...stage('unplaced'), width: undefined },
      ],
      zones,
    );
    expect(stages.map((s) => [s.id, s.zone, s.speakers, s.cameras])).toEqual([
      ['a', 'hall', 'edit', false],
      ['b', null, 'take-part', true],
    ]);
    expect(stageAt({ x: 680, y: 480 }, stages)?.id).toBe('a');
    expect(stageAt({ x: 0, y: 0 }, stages)).toBeNull();
    expect(mayTakeStage('edit', 'edit')).toBe(true);
    expect(mayTakeStage('participate', 'edit')).toBe(false);
    expect(mayTakeStage('participate', 'take-part')).toBe(true);
    expect(mayTakeStage('view', 'take-part')).toBe(false);
    expect(mayTakeStage(undefined, 'take-part')).toBe(false);
  });
});
