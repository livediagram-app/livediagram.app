// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  dockedBounds,
  ES_DOCK_SEAM_PX,
  type BoxedElement,
  type Element,
  type StickyElement,
  type Tab,
} from '@livediagram/diagram';
import { track } from '@/lib/telemetry';
import { insertElementAt, type InsertionSlot } from '@/lib/insert-between';
import { useDockActions } from './useDockActions';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn(), titleCaseType: (s: string) => s }));

// The three acts of docking (spec/139 Phase 7), through the hook that commits
// them. The placement rules are pinned in lib/dock-add.test.ts; what is tested
// here is the ACT: what the catalogue decides, what the board commits, what
// the gate refuses, and that a note arrives through the one builder.

function note(id: string, kind: string, x: number, y = 500): StickyElement {
  return {
    id,
    type: 'sticky',
    esKind: kind,
    fixedSize: true,
    x,
    y,
    width: 200,
    height: 200,
  } as StickyElement;
}

function harness(elements: Element[], over: { createBlocked?: boolean } = {}) {
  let live = elements;
  // One "commit" per undoable step, counted: the whole claim is that an
  // anchor-add (ripple included) is ONE.
  let steps = 0;
  const edited: string[] = [];
  const tab = { id: 't', name: 'Board', kind: 'event-storming', elements: live } as Tab;
  const view = renderHook(() =>
    useDockActions({
      activeTab: {
        ...tab,
        get elements() {
          return live;
        },
      } as Tab,
      createBlocked: over.createBlocked === true,
      layerInertIds: new Set<string>(),
      commit: (m) => {
        steps += 1;
        live = m(live);
      },
      // The editor's real addBoxedAt semantics, minimally: build centred on
      // the point, ripple first when a slot came with it, one commit.
      addBoxedAt: (<T extends BoxedElement>(
        cx: number,
        cy: number,
        make: (x: number, y: number) => T,
        opts?: { edit?: boolean; insertion?: InsertionSlot | null },
      ) => {
        const base = make(0, 0);
        const el = { ...base, x: cx - base.width / 2, y: cy - base.height / 2 };
        steps += 1;
        live = opts?.insertion ? insertElementAt(live, opts.insertion, el) : [...live, el];
        if (opts?.edit) edited.push(el.id);
      }) as never,
    }),
  );
  return {
    api: () => view.result.current,
    elements: () => live,
    byId: (id: string) => live.find((el) => el.id === id) as StickyElement,
    added: () => live[live.length - 1] as StickyElement,
    steps: () => steps,
    edited,
  };
}

const host = note('e', 'domain-event', 1000);

afterEach(() => {
  cleanup();
  vi.mocked(track).mockClear();
});

describe('addDockedNote', () => {
  it('adds the note the FACE names, docked and open for typing', () => {
    const h = harness([host]);
    h.api().addDockedNote('e', 'before');
    const added = h.added();
    expect(added.esKind).toBe('command');
    expect(added.esDock).toEqual({ hostId: 'e', side: 'before' });
    expect(added).toMatchObject(dockedBounds(host, 'before', 'command'));
    expect(h.edited).toEqual([added.id]);
  });

  it('adds a policy on the other face of the same event', () => {
    const h = harness([host]);
    h.api().addDockedNote('e', 'after');
    expect(h.added().esKind).toBe('policy');
  });

  it('adds a command after a policy', () => {
    const policy = { ...note('p', 'policy', 2000), width: 300, height: 180 } as StickyElement;
    const h = harness([policy]);
    h.api().addDockedNote('p', 'after');
    expect(h.added().esKind).toBe('command');
    expect(h.added().esDock).toEqual({ hostId: 'p', side: 'after' });
  });

  it('mints the note through the ONE builder — stationery and all', () => {
    const h = harness([host]);
    h.api().addDockedNote('e', 'after');
    const added = h.added();
    // A policy is WIDE, fixed, auto-fitting, centred, tilted, and carries the
    // notation's colour — none of which this hook decides.
    expect(added).toMatchObject({
      width: 300,
      height: 180,
      fixedSize: true,
      textSize: 'scale',
      textAlignX: 'center',
      textAlignY: 'middle',
      fillColor: '#d8b4fe',
    });
    expect(Math.abs(added.rotation ?? 0)).toBeLessThanOrEqual(1.1);
  });

  it('refuses a face that is already taken', () => {
    const taken = note('c', 'command', dockedBounds(host, 'before', 'command').x);
    const h = harness([host, { ...taken, esDock: { hostId: 'e', side: 'before' } } as Element]);
    h.api().addDockedNote('e', 'before');
    // The affordance is only offered on a free face, but a peer can take one
    // between the render and the click — so the ACT refuses too, rather than
    // stacking a second note on the same spot.
    expect(h.steps()).toBe(0);
  });

  it('refuses to dock a second note onto an occupied face', () => {
    const taken = note('c', 'command', dockedBounds(host, 'before', 'command').x);
    const h = harness([
      host,
      { ...taken, esDock: { hostId: 'e', side: 'before' } } as Element,
      note('c2', 'command', 0, 0),
    ]);
    h.api().dockTo('c2', 'e', 'before');
    expect(h.steps()).toBe(0);
  });

  it('opens the board in the SAME step when the spot is taken', () => {
    const face = dockedBounds(host, 'after', 'policy');
    const squatter = note('sq', 'domain-event', face.x);
    const h = harness([host, squatter]);
    h.api().addDockedNote('e', 'after');
    expect(h.steps()).toBe(1);
    expect(h.byId('sq').x).toBe(face.x + face.width + ES_DOCK_SEAM_PX);
    expect(h.added()).toMatchObject({ x: face.x, y: face.y });
  });

  it('does nothing on a host that is not a workshop note', () => {
    const h = harness([
      { id: 's', type: 'shape', shape: 'square', x: 0, y: 0, width: 9, height: 9 } as Element,
    ]);
    h.api().addDockedNote('s', 'before');
    expect(h.steps()).toBe(0);
  });

  it('refuses in a read-only / locked / blocked-layer session', () => {
    const h = harness([host], { createBlocked: true });
    h.api().addDockedNote('e', 'before');
    expect(h.steps()).toBe(0);
    expect(track).not.toHaveBeenCalled();
  });

  it('reports the act and the note', () => {
    const h = harness([host]);
    h.api().addDockedNote('e', 'before');
    expect(track).toHaveBeenCalledWith('Canvas', 'Used', 'DockAdd');
    expect(track).toHaveBeenCalledWith('Element', 'Added', 'Sticky');
  });
});

describe('dockTo / undock', () => {
  const loose = note('c', 'command', 0, 0);

  it('docks a note already on the board, in one step', () => {
    const h = harness([host, loose]);
    h.api().dockTo('c', 'e', 'before');
    expect(h.steps()).toBe(1);
    expect(h.byId('c').esDock).toEqual({ hostId: 'e', side: 'before' });
    expect(h.byId('c')).toMatchObject(dockedBounds(host, 'before', 'command'));
    expect(track).toHaveBeenCalledWith('Canvas', 'Used', 'Dock');
  });

  it('undocks one, leaving it exactly where it sits', () => {
    const h = harness([host, loose]);
    h.api().dockTo('c', 'e', 'before');
    const at = h.byId('c').x;
    h.api().undock('c');
    expect('esDock' in h.byId('c')).toBe(false);
    expect(h.byId('c').x).toBe(at);
    expect(track).toHaveBeenCalledWith('Canvas', 'Used', 'Undock');
  });

  it('refuses both when the session cannot edit', () => {
    const h = harness([host, loose], { createBlocked: true });
    h.api().dockTo('c', 'e', 'before');
    h.api().undock('c');
    expect(h.steps()).toBe(0);
  });
});
