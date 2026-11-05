import { describe, expect, it } from 'vitest';
import { callStages, createShape, roomZones } from '@livehuddle/document';
import { stageStanders, standersLabel } from './stage-presence';

// docs/specs/012-collaboration/meeting-rooms-and-stage.md "The stage shows who is on it".

const stage = { ...createShape('stage', 0, 0), id: 's1', x: 0, y: 0, width: 400, height: 200 };
const stages = callStages([stage], roomZones([stage]));
const top = { x: stages[0]!.x0 + 10, y: stages[0]!.y0 + 10 };

describe('stageStanders', () => {
  it('names you and the peers standing on the stage, and nobody off it', () => {
    const by = stageStanders(stages, { at: top, color: '#f00' }, [
      { name: 'Sam', color: '#0f0', at: top },
      { name: 'Ali', color: '#00f', at: { x: 2000, y: 2000 } },
    ]);
    expect(by.get('s1')).toEqual([
      { name: 'You', color: '#f00' },
      { name: 'Sam', color: '#0f0' },
    ]);
  });

  it('is empty with nobody on a stage, or no stage at all', () => {
    expect(stageStanders(stages, null, []).size).toBe(0);
    expect(stageStanders([], { at: top, color: '#f00' }, []).size).toBe(0);
  });
});

describe('standersLabel', () => {
  it('reads one, two and many', () => {
    const p = (name: string) => ({ name, color: '#000' });
    expect(standersLabel([p('You')])).toBe('You');
    expect(standersLabel([p('You'), p('Sam')])).toBe('You and Sam');
    expect(standersLabel([p('Alex'), p('Sam'), p('Ali'), p('Jo')])).toBe('Alex, Sam +2');
  });
});
