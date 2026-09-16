import { describe, expect, it } from 'vitest';
import {
  ES_DOCK_SEAM_PX,
  dockedBounds,
  type Element,
  type StickyElement,
} from '@livediagram/diagram';
import { applyInsertionShift } from './insert-between';
import { planDockAdd } from './dock-add';

// Anchor-add placement (spec/139 Phase 7, Q13): the note lands on the face, and
// where the face is occupied the board OPENS with the shipped insertion ripple
// rather than refusing — the same behaviour the Alt gesture already taught.

function note(id: string, kind: string, x: number, y = 500, w = 200, h = 200): StickyElement {
  return {
    id,
    type: 'sticky',
    esKind: kind,
    fixedSize: true,
    x,
    y,
    width: w,
    height: h,
  } as StickyElement;
}

const host = note('e', 'domain-event', 1000);

describe('planDockAdd', () => {
  it('puts the note on the free face and moves nothing', () => {
    const plan = planDockAdd([host], 'e', 'before', 'command')!;
    expect(plan.bounds).toEqual(dockedBounds(host, 'before', 'command'));
    expect(plan.ripple).toBeNull();
  });

  it('knows nothing about a host that is not a workshop note', () => {
    const shape = {
      id: 's',
      type: 'shape',
      shape: 'square',
      x: 0,
      y: 0,
      width: 10,
      height: 10,
    } as Element;
    expect(planDockAdd([shape], 's', 'before', 'command')).toBeNull();
    expect(planDockAdd([], 'gone', 'before', 'command')).toBeNull();
  });

  it('opens the board when the AFTER face is occupied, leaving the host put', () => {
    const face = dockedBounds(host, 'after', 'policy');
    const squatter = note('sq', 'domain-event', face.x);
    const plan = planDockAdd([host, squatter], 'e', 'after', 'policy')!;
    expect(plan.ripple).not.toBeNull();
    const after = applyInsertionShift([host, squatter], plan.ripple!);
    expect((after.find((el) => el.id === 'e') as StickyElement).x).toBe(1000);
    // The squatter stood aside by exactly the note plus its seam…
    expect((after.find((el) => el.id === 'sq') as StickyElement).x).toBe(
      face.x + face.width + ES_DOCK_SEAM_PX,
    );
    // …and the note lands in the space that opened, touching nothing.
    expect(plan.bounds).toEqual(face);
  });

  it('opens the board when the BEFORE face is occupied, carrying the host right', () => {
    const face = dockedBounds(host, 'before', 'command');
    const squatter = note('sq', 'domain-event', face.x);
    const plan = planDockAdd([host, squatter], 'e', 'before', 'command')!;
    const after = applyInsertionShift([host, squatter], plan.ripple!);
    const movedHost = after.find((el) => el.id === 'e') as StickyElement;
    // The host travelled; the squatter, being LEFT of it, did not.
    expect(movedHost.x).toBe(1000 + 200 + ES_DOCK_SEAM_PX);
    expect((after.find((el) => el.id === 'sq') as StickyElement).x).toBe(face.x);
    // The note lands on the moved host's face — and clear of the squatter.
    expect(plan.bounds).toEqual(dockedBounds(movedHost, 'before', 'command'));
    expect(plan.bounds.x).toBeGreaterThanOrEqual(face.x + face.width);
  });

  it('is not disturbed by a note on the OTHER face', () => {
    const before = note('c', 'command', dockedBounds(host, 'before', 'command').x);
    const plan = planDockAdd([host, before], 'e', 'after', 'policy')!;
    expect(plan.ripple).toBeNull();
  });

  it('cannot be blocked by something the author cannot see', () => {
    const face = dockedBounds(host, 'after', 'policy');
    const hidden = note('h', 'domain-event', face.x);
    const plan = planDockAdd([host, hidden], 'e', 'after', 'policy', new Set(['h']))!;
    expect(plan.ripple).toBeNull();
  });

  it('opens around a LOCKED squatter rather than shoving it', () => {
    const face = dockedBounds(host, 'after', 'policy');
    const locked = { ...note('sq', 'domain-event', face.x), locked: true } as Element;
    const plan = planDockAdd([host, locked], 'e', 'after', 'policy')!;
    // Nothing movable sits at or after the point, so there is no ripple to
    // make — the board has nothing it is allowed to move.
    expect(plan.ripple).toBeNull();
  });
});
