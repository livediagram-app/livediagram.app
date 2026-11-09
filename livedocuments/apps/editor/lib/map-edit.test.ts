import { describe, expect, it } from 'vitest';
import { createShape, type Element } from '@livedocuments/document';
import { canEditMap } from './map-edit';

// docs/specs/009-elements/map.md "Who may do what", locked per role.
describe('canEditMap', () => {
  const map = createShape('map', 0, 0) as Element;

  it('lets an Editor edit an unlocked map', () => {
    expect(canEditMap({ level: 'edit' }, map)).toBe(true);
  });

  it('keeps a Participant and a Viewer out', () => {
    expect(canEditMap({ level: 'participate' }, map)).toBe(false);
    expect(canEditMap({ level: 'view' }, map)).toBe(false);
  });

  it('keeps everyone out of a locked map, and answers only for maps', () => {
    expect(canEditMap({ level: 'edit' }, { ...map, locked: true })).toBe(false);
    expect(canEditMap({ level: 'edit' }, createShape('square', 0, 0) as Element)).toBe(false);
  });
});
