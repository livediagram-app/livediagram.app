import { describe, expect, it } from 'vitest';
import { hasLegacyGroups, isValidElement, migrateLegacyGroups, type Element } from './index';

// A tab as it was stored while groups existed (docs/specs/009-elements/web-components-and-no-groups.md): members carry a
// groupId, and an arrow end can be pinned to the group's union box.
const legacy = (): Element[] =>
  [
    { id: 'a', type: 'shape', shape: 'square', x: 0, y: 0, width: 100, height: 80, groupId: 'g' },
    { id: 'b', type: 'shape', shape: 'square', x: 200, y: 0, width: 100, height: 80, groupId: 'g' },
    { id: 'c', type: 'shape', shape: 'square', x: 0, y: 300, width: 50, height: 50 },
    {
      id: 'arr',
      type: 'arrow',
      from: { kind: 'pinned-group', groupId: 'g', anchor: 's' },
      to: { kind: 'pinned', elementId: 'c', anchor: 'n' },
    },
  ] as unknown as Element[];

describe('migrateLegacyGroups (docs/specs/009-elements/web-components-and-no-groups.md)', () => {
  it('freezes a group-pinned end where it resolved: the union box anchor', () => {
    const out = migrateLegacyGroups(legacy());
    const arrow = out.find((e) => e.id === 'arr');
    // Union spans x 0..300, y 0..80, so the south midpoint is (150, 80).
    expect(arrow).toMatchObject({
      from: { kind: 'free', x: 150, y: 80 },
      to: { kind: 'pinned', elementId: 'c', anchor: 'n' },
    });
  });

  it('strips groupId and leaves no trace for hasLegacyGroups', () => {
    const out = migrateLegacyGroups(legacy());
    expect(out.some((e) => 'groupId' in e)).toBe(false);
    expect(hasLegacyGroups(out)).toBe(false);
    expect(out.every(isValidElement)).toBe(true);
  });

  it('returns the same array for a tab that never used groups', () => {
    const clean = legacy().filter((e) => e.id === 'c');
    expect(migrateLegacyGroups(clean)).toBe(clean);
  });

  it('resolves an end whose group has no members left to the origin, as it rendered', () => {
    const els = legacy().filter((e) => e.id !== 'a' && e.id !== 'b');
    const arrow = migrateLegacyGroups(els).find((e) => e.id === 'arr');
    expect(arrow).toMatchObject({ from: { kind: 'free', x: 0, y: 0 } });
  });

  it('still accepts the legacy end on write, so an old build can save', () => {
    expect(isValidElement(legacy()[3])).toBe(true);
  });
});
