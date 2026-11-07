import { describe, expect, it } from 'vitest';
import { CORRIDOR_VARIANTS, DOOR_VARIANTS, ROOM_PRESETS, RUG_VARIANTS } from '@livehuddle/document';
import { PALETTE_TILES } from './palette-tile-defs';
import {
  CORRIDOR_PRESET_TILES,
  DOOR_PRESET_TILES,
  ROOM_PRESET_TILES,
  RUG_PRESET_TILES,
} from './palette-floor-presets';

// docs/specs/009-elements/office.md "Room presets" and "Rug types", corridor.md, room-builder.md "Door types": the
// Rooms category's Room, Corridor, Door and Rug tiles each open their presets, as the Card and the Badge do.

const tile = (id: string) => PALETTE_TILES.find((t) => t.id === id)!;
const variantsOf = (tiles: readonly { action: { type: string; variant?: string } }[]) =>
  tiles.map((t) => (t.action.type === 'shape' ? t.action.variant : 'none'));

describe('the floor presets', () => {
  it('hang under the Room, Corridor, Door and Rug tiles', () => {
    expect(tile('tools:room').variants).toBe(ROOM_PRESET_TILES);
    expect(tile('tools:corridor').variants).toBe(CORRIDOR_PRESET_TILES);
    expect(tile('tools:wall-door').variants).toBe(DOOR_PRESET_TILES);
    expect(tile('tools:rug').variants).toBe(RUG_PRESET_TILES);
    for (const id of ['tools:room', 'tools:corridor', 'tools:wall-door', 'tools:rug'])
      expect(tile(id).variantsHint).toBeTruthy();
  });

  it('offer six rooms, four corridors, four doors and eight rugs, each the model knows, the first the plain one', () => {
    expect(variantsOf(ROOM_PRESET_TILES)).toEqual([undefined, ...Object.keys(ROOM_PRESETS)]);
    expect(variantsOf(CORRIDOR_PRESET_TILES)).toEqual([undefined, ...CORRIDOR_VARIANTS.slice(1)]);
    expect(variantsOf(DOOR_PRESET_TILES)).toEqual([undefined, ...DOOR_VARIANTS.slice(1)]);
    expect(variantsOf(RUG_PRESET_TILES)).toEqual([undefined, ...RUG_VARIANTS.slice(1)]);
  });

  it('are ordinary tiles: unique ids, Title Case captions, an Add label and words to read', () => {
    const all = [
      ...ROOM_PRESET_TILES,
      ...CORRIDOR_PRESET_TILES,
      ...DOOR_PRESET_TILES,
      ...RUG_PRESET_TILES,
    ];
    expect(new Set(all.map((t) => t.id)).size).toBe(all.length);
    for (const t of all) {
      expect(t.label.startsWith('Add ')).toBe(true);
      expect(t.caption).toMatch(/^[A-Z][a-z]*(?:[- ][A-Z][a-z]*)*$/);
      expect(t.blurb!.length).toBeLessThanOrEqual(40);
      expect(t.description.length).toBeGreaterThan(t.blurb!.length);
    }
    expect(ROOM_PRESET_TILES.map((t) => t.label)).toContain('Add Boardroom');
    expect(DOOR_PRESET_TILES.map((t) => t.label)).toEqual([
      'Add Door',
      'Add Double Door',
      'Add Sliding Door',
      'Add Revolving Door',
    ]);
    expect(RUG_PRESET_TILES[0]!.label).toBe('Add Oval Rug');
    expect(CORRIDOR_PRESET_TILES[2]!.label).toBe('Add T-Junction Corridor');
  });

  it('stay out of the catalogue itself, so Search keeps one tile each', () => {
    expect(PALETTE_TILES.filter((t) => t.id === 'tools:room-office')).toEqual([]);
    expect(PALETTE_TILES.filter((t) => t.id.startsWith('tools:corridor'))).toHaveLength(1);
  });
});
