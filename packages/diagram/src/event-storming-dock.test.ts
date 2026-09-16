import { describe, expect, it } from 'vitest';
import {
  dock,
  dockableFaces,
  dockClusterOf,
  dockedBounds,
  dockedNotesOf,
  dockingFor,
  ES_DOCK_SEAM_PX,
  ES_DOCK_SNAP_PX,
  ES_DOCKINGS,
  findDockCandidate,
  isFaceFree,
  seamDots,
  stripDanglingDocks,
  undock,
} from './event-storming-dock';
import { ES_NOTE_SIZE_PX, type EventStormingNoteKind } from './event-storming';
import type { Element, StickyElement } from './index';

function note(
  id: string,
  kind: EventStormingNoteKind,
  x: number,
  y: number,
  over: Partial<StickyElement> = {},
): StickyElement {
  const size =
    ES_NOTE_SIZE_PX[
      kind === 'policy' || kind === 'external-system' || kind === 'aggregate'
        ? 'wide'
        : kind === 'actor'
          ? 'small'
          : 'square'
    ];
  return {
    id,
    type: 'sticky',
    esKind: kind,
    fixedSize: true,
    x,
    y,
    width: size.width,
    height: size.height,
    ...over,
  } as StickyElement;
}

describe('the docking catalogue', () => {
  it('holds exactly the three pairings the notation has', () => {
    expect(ES_DOCKINGS).toEqual([
      { kind: 'command', hostKind: 'domain-event', side: 'before' },
      { kind: 'command', hostKind: 'policy', side: 'after' },
      { kind: 'policy', hostKind: 'domain-event', side: 'after' },
    ]);
  });

  it('answers for a pairing it has, and refuses one it does not', () => {
    expect(dockingFor('command', 'domain-event')?.side).toBe('before');
    expect(dockingFor('policy', 'domain-event')?.side).toBe('after');
    expect(dockingFor('command', 'policy')?.side).toBe('after');
    // Not in v1: an actor under a command, a read model before it, …
    expect(dockingFor('actor', 'command')).toBeNull();
    expect(dockingFor('domain-event', 'command')).toBeNull();
    expect(dockingFor('hotspot', 'domain-event')).toBeNull();
  });

  it('lists the faces a host offers', () => {
    expect(dockableFaces('domain-event')).toEqual([
      { side: 'before', kind: 'command' },
      { side: 'after', kind: 'policy' },
    ]);
    expect(dockableFaces('policy')).toEqual([{ side: 'after', kind: 'command' }]);
    expect(dockableFaces('actor')).toEqual([]);
    expect(dockableFaces('command')).toEqual([]);
  });
});

describe('dockedBounds', () => {
  const event = note('e', 'domain-event', 1000, 500);

  it('puts a BEFORE note a seam to the left, centred on the host', () => {
    const b = dockedBounds(event, 'before', 'command');
    expect(b.x).toBe(1000 - ES_DOCK_SEAM_PX - 200);
    expect(b.y).toBe(500);
    expect(b).toMatchObject({ width: 200, height: 200 });
  });

  it('puts an AFTER note a seam to the right', () => {
    const b = dockedBounds(event, 'after', 'policy');
    expect(b.x).toBe(1000 + 200 + ES_DOCK_SEAM_PX);
  });

  it('centres mixed stationery on the host rather than aligning tops', () => {
    // A 180-tall policy against a 200-tall event: 10px of overhang each side.
    const b = dockedBounds(event, 'after', 'policy');
    expect(b.y).toBe(500 + (200 - 180) / 2);
    expect(b.y + b.height / 2).toBe(event.y + event.height / 2);
  });
});

describe('findDockCandidate', () => {
  const event = note('e', 'domain-event', 1000, 500);
  const target = dockedBounds(event, 'before', 'command');

  const candidateAt = (dx: number, dy: number, over: { elements?: Element[] } = {}) =>
    findDockCandidate(
      { ...target, x: target.x + dx, y: target.y + dy, kind: 'command', id: 'c' },
      over.elements ?? [event, note('c', 'command', 0, 0)],
    );

  it('claims a compatible free face within the snap distance', () => {
    const hit = candidateAt(ES_DOCK_SNAP_PX - 1, ES_DOCK_SNAP_PX - 1);
    expect(hit).toMatchObject({ hostId: 'e', side: 'before' });
    expect(hit!.bounds).toEqual(target);
  });

  it('lets go beyond it, on either axis', () => {
    expect(candidateAt(ES_DOCK_SNAP_PX + 1, 0)).toBeNull();
    expect(candidateAt(0, ES_DOCK_SNAP_PX + 1)).toBeNull();
  });

  it('refuses a face that is already taken', () => {
    const taken = note('other', 'command', target.x, target.y, {
      esDock: { hostId: 'e', side: 'before' },
    });
    expect(candidateAt(2, 2, { elements: [event, taken, note('c', 'command', 0, 0)] })).toBeNull();
  });

  it('never docks a note to itself', () => {
    const selfHit = findDockCandidate({ ...target, kind: 'command', id: 'e' }, [
      event,
      note('c', 'command', 0, 0),
    ]);
    expect(selfHit).toBeNull();
  });

  it('ignores a locked host — it was pinned there on purpose', () => {
    const locked = { ...event, locked: true } as Element;
    expect(candidateAt(2, 2, { elements: [locked] })).toBeNull();
  });

  it('ignores a host the author cannot see', () => {
    expect(
      findDockCandidate({ ...target, kind: 'command', id: 'c' }, [event], {
        inertIds: new Set(['e']),
      }),
    ).toBeNull();
  });

  it('ignores an element that is not a workshop note at all', () => {
    const shape = {
      id: 's',
      type: 'shape',
      shape: 'square',
      x: 1000,
      y: 500,
      width: 200,
      height: 200,
    } as Element;
    expect(candidateAt(2, 2, { elements: [shape] })).toBeNull();
  });

  it('picks the NEAREST host when two are in range', () => {
    const near = note('near', 'domain-event', 1000, 500);
    const far = note('far', 'domain-event', 1000 + 30, 500 + 30);
    const hit = findDockCandidate({ ...target, kind: 'command', id: 'c' }, [far, near]);
    expect(hit?.hostId).toBe('near');
  });

  it('has nothing to offer for a kind that docks nowhere', () => {
    expect(findDockCandidate({ ...target, kind: 'actor', id: 'a' }, [event])).toBeNull();
  });
});

describe('the cluster', () => {
  const event = note('e', 'domain-event', 1000, 500);
  const command = note('c', 'command', 784, 500, { esDock: { hostId: 'e', side: 'before' } });
  const policy = note('p', 'policy', 1216, 510, { esDock: { hostId: 'e', side: 'after' } });
  const loose = note('x', 'command', 0, 0);
  const board = [event, command, policy, loose];

  it('finds what is docked to a host', () => {
    expect(dockedNotesOf('e', board).map((el) => el.id)).toEqual(['c', 'p']);
    expect(dockedNotesOf('c', board)).toEqual([]);
  });

  it('answers the same set from either end', () => {
    const fromHost = dockClusterOf('e', board)
      .map((el) => el.id)
      .sort();
    const fromDocked = dockClusterOf('c', board)
      .map((el) => el.id)
      .sort();
    expect(fromHost).toEqual(['c', 'e', 'p']);
    expect(fromDocked).toEqual(fromHost);
  });

  it('is just the element itself when nothing is docked', () => {
    expect(dockClusterOf('x', board).map((el) => el.id)).toEqual(['x']);
  });

  it('knows which faces are free', () => {
    expect(isFaceFree('e', 'before', board)).toBe(false);
    expect(isFaceFree('e', 'after', board)).toBe(false);
    expect(isFaceFree('x', 'after', board)).toBe(true);
  });
});

describe('seamDots', () => {
  const event = note('e', 'domain-event', 1000, 500);

  it('puts one dot on each facing edge, at the shared centre line', () => {
    const docked = note('c', 'command', dockedBounds(event, 'before', 'command').x, 500);
    const [a, b] = seamDots(event, docked, 'before');
    expect(a.x).toBe(docked.x + docked.width);
    expect(b.x).toBe(event.x);
    expect(a.y).toBe(600);
    expect(b.y).toBe(600);
  });

  it('mirrors for the other side', () => {
    const bounds = dockedBounds(event, 'after', 'policy');
    const docked = note('p', 'policy', bounds.x, bounds.y);
    const [a, b] = seamDots(event, docked, 'after');
    expect(a.x).toBe(event.x + event.width);
    expect(b.x).toBe(docked.x);
  });
});

describe('dock / undock', () => {
  const event = note('e', 'domain-event', 1000, 500);
  const command = note('c', 'command', 0, 0);

  it('stamps the relation and moves the note into place', () => {
    const next = dock([event, command], 'c', 'e', 'before');
    const moved = next.find((el) => el.id === 'c') as StickyElement;
    expect(moved.esDock).toEqual({ hostId: 'e', side: 'before' });
    expect(moved.x).toBe(dockedBounds(event, 'before', 'command').x);
    expect(next.find((el) => el.id === 'e')).toBe(event);
  });

  it('refuses a pairing the notation does not have', () => {
    const els = [event, note('a', 'actor', 0, 0)];
    expect(dock(els, 'a', 'e', 'before')).toBe(els);
  });

  it('removes the relation and nothing else', () => {
    const docked = dock([event, command], 'c', 'e', 'before');
    const next = undock(docked, 'c');
    const loose = next.find((el) => el.id === 'c') as StickyElement;
    expect('esDock' in loose).toBe(false);
    expect(loose.x).toBe((docked.find((el) => el.id === 'c') as StickyElement).x);
  });

  it('returns the SAME array when there is nothing to undock', () => {
    const els = [event, command];
    expect(undock(els, 'c')).toBe(els);
  });
});

describe('stripDanglingDocks', () => {
  const event = note('e', 'domain-event', 1000, 500);
  const command = note('c', 'command', 784, 500, { esDock: { hostId: 'e', side: 'before' } });

  it('frees a note whose host is not there', () => {
    const after = stripDanglingDocks([command]);
    expect('esDock' in (after[0] as StickyElement)).toBe(false);
  });

  it('leaves a whole cluster alone, object identity included', () => {
    const board = [event, command];
    expect(stripDanglingDocks(board)).toBe(board);
  });

  it('touches nothing else on the note', () => {
    const after = stripDanglingDocks([command]);
    expect(after[0]).toMatchObject({ id: 'c', x: 784, esKind: 'command', fixedSize: true });
  });
});
