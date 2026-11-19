import { describe, expect, it, vi } from 'vitest';
import { scanScenes, unmarkedConnectors, type DrawnShape } from './connector-guard';

// livehuddle's liveworkspace/docs/specs/017-help/help-centre.md "A figure cannot forget the mark" (Work Tracker 790): an Arrow joining
// two Shapes must be marked `connector`, or livehuddle's sticky-only figures would still draw it.

vi.mock('./primitives-canvas', async (importOriginal) => {
  const { withRecording } = await import('./connector-guard');
  return withRecording(await importOriginal<typeof import('./primitives-canvas')>());
});

const a: DrawnShape = { x: 0, y: 0, w: 72, h: 44 };
const b: DrawnShape = { x: 120, y: 0, w: 72, h: 44 };

describe('unmarkedConnectors', () => {
  it('flags an unmarked arrow from one shape to another, ends a few units off their edges', () => {
    const arrow = { from: [76, 22] as [number, number], to: [116, 22] as [number, number] };
    expect(unmarkedConnectors([a, b], [arrow])).toHaveLength(1);
    expect(unmarkedConnectors([a, b], [{ ...arrow, connector: true }])).toEqual([]);
    // Written out as not a connector (a sync link, a flow between app windows): left alone.
    expect(unmarkedConnectors([a, b], [{ ...arrow, connector: false }])).toEqual([]);
  });

  it('leaves alone an arrow with an end in open space or both ends on one shape', () => {
    expect(unmarkedConnectors([a, b], [{ from: [76, 22], to: [100, 120] }])).toEqual([]);
    expect(unmarkedConnectors([a, b], [{ from: [300, 22], to: [76, 22] }])).toEqual([]);
    expect(unmarkedConnectors([a], [{ from: [10, 10], to: [60, 30] }])).toEqual([]);
  });
});

describe('every scene in the shared kit', () => {
  it('marks each arrow that joins two shapes as a connector', async () => {
    const modules = import.meta.glob<Record<string, unknown>>(
      ['./**/*.tsx', '!./**/*.test.tsx', '!./connector-guard.tsx'],
      { eager: true },
    );
    const { scanned, findings } = scanScenes(modules);
    // The guard really drew the scenes: dozens of them hold shapes.
    expect(scanned).toBeGreaterThan(20);
    expect(findings).toEqual([]);
  });

  it('skips a component that needs props and a value that is not a component', () => {
    const Needy = ({ list }: { list: string[] }) => <g>{list.length}</g>;
    expect(scanScenes({ x: { Needy, value: 3, lower: () => null } })).toEqual({
      scanned: 0,
      findings: [],
    });
  });
});
