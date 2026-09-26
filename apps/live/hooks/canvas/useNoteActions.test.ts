// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ES_NOTE_GAP,
  nextNoteBounds,
  type BoxedElement,
  type Element,
  type StickyElement,
  type Tab,
} from '@livediagram/diagram';
import { track } from '@/lib/telemetry';
import { insertElementAt, type InsertionSlot } from '@/lib/insert-between';
import { useNoteActions } from './useNoteActions';

vi.mock('@/lib/telemetry', () => ({ track: vi.fn(), titleCaseType: (s: string) => s }));

// The note acts on an event-storming board (spec/139), through the hook that
// commits them. Next-note placement is pinned in lib/next-note-add.test.ts;
// what is tested here is the ACT: what the catalogue decides, what the board
// commits, what the gate refuses, and that a note arrives through the one
// builder.

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
  // add (ripple included) is ONE.
  let steps = 0;
  const edited: string[] = [];
  const tab = { id: 't', name: 'Board', kind: 'event-storming', elements: live } as Tab;
  const view = renderHook(() =>
    useNoteActions({
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

const event = note('e', 'domain-event', 1000);

afterEach(() => {
  cleanup();
  vi.mocked(track).mockClear();
});

describe('addNextNote', () => {
  it('adds the note the SIDE names, one gutter beside and open for typing', () => {
    const h = harness([event]);
    h.api().addNextNote('e', 'before');
    const added = h.added();
    expect(added.esKind).toBe('command');
    expect(added).toMatchObject(nextNoteBounds(event, 'before', 'command'));
    expect(h.edited).toEqual([added.id]);
  });

  it('keeps no relation between the two notes', () => {
    const h = harness([event]);
    h.api().addNextNote('e', 'before');
    expect(h.added()).not.toHaveProperty('esDock');
  });

  it('adds a policy on the other side of the same event', () => {
    const h = harness([event]);
    h.api().addNextNote('e', 'after');
    expect(h.added().esKind).toBe('policy');
  });

  it('adds a command after a policy', () => {
    const policy = { ...note('p', 'policy', 2000), width: 300, height: 180 } as StickyElement;
    const h = harness([policy]);
    h.api().addNextNote('p', 'after');
    expect(h.added().esKind).toBe('command');
  });

  it('mints the note through the ONE builder — stationery and all', () => {
    const h = harness([event]);
    h.api().addNextNote('e', 'after');
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

  it('opens the board in the SAME step when the spot is taken', () => {
    const spot = nextNoteBounds(event, 'after', 'policy');
    const squatter = note('sq', 'domain-event', spot.x);
    const h = harness([event, squatter]);
    h.api().addNextNote('e', 'after');
    expect(h.steps()).toBe(1);
    expect(h.byId('sq').x).toBe(spot.x + spot.width + ES_NOTE_GAP);
    expect(h.added()).toMatchObject({ x: spot.x, y: spot.y });
  });

  it('does nothing on a side the notation has no next note for', () => {
    const h = harness([event, note('c', 'command', 0, 0)]);
    h.api().addNextNote('c', 'before');
    expect(h.steps()).toBe(0);
  });

  it('does nothing on an element that is not a workshop note', () => {
    const h = harness([
      { id: 's', type: 'shape', shape: 'square', x: 0, y: 0, width: 9, height: 9 } as Element,
    ]);
    h.api().addNextNote('s', 'before');
    expect(h.steps()).toBe(0);
  });

  it('refuses in a read-only / locked / blocked-layer session', () => {
    const h = harness([event], { createBlocked: true });
    h.api().addNextNote('e', 'before');
    expect(h.steps()).toBe(0);
    expect(track).not.toHaveBeenCalled();
  });

  it('reports the act and the note', () => {
    const h = harness([event]);
    h.api().addNextNote('e', 'before');
    expect(track).toHaveBeenCalledWith('Canvas', 'Used', 'AddNextNote');
    expect(track).toHaveBeenCalledWith('Element', 'Added', 'Sticky');
  });
});

describe('setEsKindOf', () => {
  it('changes the kind of a note in one step', () => {
    const h = harness([event]);
    h.api().setEsKindOf('e', 'hotspot');
    expect(h.steps()).toBe(1);
    expect(h.byId('e').esKind).toBe('hotspot');
    expect(track).toHaveBeenCalledWith('Canvas', 'Used', 'ChangeNoteKind');
  });

  it('refuses when the session cannot edit', () => {
    const h = harness([event], { createBlocked: true });
    h.api().setEsKindOf('e', 'hotspot');
    expect(h.steps()).toBe(0);
  });
});
