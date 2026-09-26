import { describe, expect, it } from 'vitest';
import type { Tab } from './index';
import { isLayerVisible } from './layers';
import {
  changeEventStormingKind,
  eventStormingNoteSize,
  eventStormingTilt,
  ES_MAX_TILT_DEG,
  ES_BOARD_LAYER_ID,
  ES_BIG_PICTURE_LAYER_ID,
  ES_DESIGN_LAYER_ID,
  ES_PROCESS_LAYER_ID,
  EVENT_STORMING_NOTES,
  eventStormingBoardLayerId,
  eventStormingLayers,
  eventStormingNote,
  eventStormingNoteFont,
  ES_NOTE_FONT,
  isEventStormingNote,
  isEventStormingTab,
  type EventStormingNoteKind,
} from './event-storming';

// The event-storming sticky grammar (docs/specs/021-event-storming/event-storming.md): colour IS the notation, so
// the catalogue is the single source of truth for what each note kind is
// called and which fill it carries. The palette tiles, the template builder,
// and any future consumer (MCP, exports) read from here — these tests pin
// the catalogue so none of them can drift.
describe('EVENT_STORMING_NOTES', () => {
  // Every union member, kept in lockstep with the catalogue (the same
  // pattern as the templates ALL_KINDS pin).
  const ALL_KINDS = [
    'domain-event',
    'command',
    'actor',
    'policy',
    'read-model',
    'external-system',
    'aggregate',
    'hotspot',
  ] as const satisfies readonly EventStormingNoteKind[];

  it('lists every note kind exactly once', () => {
    expect(EVENT_STORMING_NOTES.map((n) => n.kind).sort()).toEqual([...ALL_KINDS].sort());
  });

  it('the workshop-defining kinds carry their canonical colours', () => {
    // Orange means domain event and blue means command in every event-storming
    // reference — pin the two whose hue is non-negotiable.
    expect(eventStormingNote('domain-event').fill).toBe('#fdba74');
    expect(eventStormingNote('command').fill).toBe('#93c5fd');
  });

  it('every note carries a label, a blurb, and a distinct hex fill', () => {
    const fills = new Set<string>();
    for (const note of EVENT_STORMING_NOTES) {
      expect(note.label.length, note.kind).toBeGreaterThan(0);
      expect(note.blurb.length, note.kind).toBeGreaterThan(0);
      expect(note.fill, note.kind).toMatch(/^#[0-9a-f]{6}$/);
      fills.add(note.fill);
    }
    expect(fills.size).toBe(EVENT_STORMING_NOTES.length);
  });

  it('every note belongs to a workshop stage (the palette routes notes by it)', () => {
    // The stage decides which layer a palette-dropped note lands on
    // (docs/specs/021-event-storming/event-storming.md): events, actors and hotspots surface in Big picture;
    // the flow kinds arrive at Process; the aggregate is design-level.
    const byStage = (stage: string) =>
      EVENT_STORMING_NOTES.filter((n) => n.stage === stage).map((n) => n.kind);
    expect(byStage('big-picture').sort()).toEqual(['actor', 'domain-event', 'hotspot']);
    expect(byStage('process').sort()).toEqual([
      'command',
      'external-system',
      'policy',
      'read-model',
    ]);
    expect(byStage('design')).toEqual(['aggregate']);
  });

  it('sizes the notes like the physical stationery set', () => {
    // Brandolini's kit: standard squares for events / commands / read
    // models / hotspots, WIDE stickies for the prose kinds (policy,
    // external system, aggregate), and a small square for the actor.
    expect(eventStormingNoteSize('domain-event')).toEqual({ width: 200, height: 200 });
    expect(eventStormingNoteSize('command')).toEqual({ width: 200, height: 200 });
    expect(eventStormingNoteSize('read-model')).toEqual({ width: 200, height: 200 });
    expect(eventStormingNoteSize('hotspot')).toEqual({ width: 200, height: 200 });
    expect(eventStormingNoteSize('policy')).toEqual({ width: 300, height: 180 });
    expect(eventStormingNoteSize('external-system')).toEqual({ width: 300, height: 180 });
    expect(eventStormingNoteSize('aggregate')).toEqual({ width: 300, height: 180 });
    expect(eventStormingNoteSize('actor')).toEqual({ width: 140, height: 140 });
  });

  it('files every note kind on the one board layer', () => {
    // One wall of paper: a note's kind says what it IS, not which plane it
    // lives on. Stage bands meant two notes could never stack against each
    // other, because layers paint as separate bands.
    expect(eventStormingBoardLayerId()).toBe(ES_BOARD_LAYER_ID);
  });

  it('eventStormingNote resolves every kind', () => {
    for (const kind of ALL_KINDS) {
      expect(eventStormingNote(kind).kind).toBe(kind);
    }
  });
});

// The workshop-stage views (docs/specs/021-event-storming/event-storming.md): shared layer-visibility presets over
// the docs/specs/006-diagram/layers.md layers the template ships. Switching stage = one tab commit
// that sets each stage layer's visibility; the rail is an independent
// see-it-against-a-timeline toggle. Everything here is pure Tab -> Tab.
describe('event-storming views', () => {
  const esTab = (): Tab =>
    ({ id: 't', name: 'T', elements: [], layers: eventStormingLayers() }) as unknown as Tab;

  it('ships exactly one layer, visible', () => {
    const layers = eventStormingLayers();
    expect(layers.map((l) => l.id)).toEqual([ES_BOARD_LAYER_ID]);
    expect(layers.every((l) => isLayerVisible(l))).toBe(true);
  });

  it('recognises an event-storming tab by its layer', () => {
    expect(isEventStormingTab(esTab())).toBe(true);
    expect(isEventStormingTab(undefined)).toBe(false);
    expect(isEventStormingTab({ layers: [{ id: 'layer:default', name: 'Layer 1' }] })).toBe(false);
  });

  it('still recognises a board built before the stage layers collapsed', () => {
    // Those boards are out there with three bands; they must keep their
    // palette, stationery and note menu.
    for (const id of [ES_BIG_PICTURE_LAYER_ID, ES_PROCESS_LAYER_ID, ES_DESIGN_LAYER_ID]) {
      expect(isEventStormingTab({ layers: [{ id, name: 'legacy' }] })).toBe(true);
    }
  });

  it('survives a user editing the layer stack', () => {
    // Board-ness is an identity, not a checklist: layers are ordinary
    // docs/specs/006-diagram/layers.md data a facilitator can rename, delete or add to mid-workshop.
    expect(
      isEventStormingTab({
        layers: [{ id: 'own-layer', name: 'Sketches' }, ...eventStormingLayers()],
      }),
    ).toBe(true);
    expect(isEventStormingTab({ layers: [{ id: 'own-layer', name: 'Sketches' }] })).toBe(false);
  });
});

// A copied workshop note is a NEW piece of paper: it gets its own id and its
// own hand-placement (docs/specs/021-event-storming/event-storming.md). Keeping the source's exact tilt made a
// duplicate read as a photocopy — two notes at identical angles, which is
// the one thing a real wall never shows.
describe('event-storming tilt', () => {
  it('stays inside the calibrated band', () => {
    for (let i = 0; i < 50; i++) {
      const t = eventStormingTilt();
      expect(Math.abs(t)).toBeLessThanOrEqual(ES_MAX_TILT_DEG);
      // One decimal — a tidy number in the stored JSON.
      expect(Math.round(t * 10) / 10).toBe(t);
    }
  });

  it('varies (it is a fresh placement, not a constant)', () => {
    const seen = new Set(Array.from({ length: 40 }, () => eventStormingTilt()));
    expect(seen.size).toBeGreaterThan(1);
  });
});

// A workshop note IS a note, whatever it says. The caps rule (docs/specs/021-event-storming/event-storming.md)
// and any future notation-aware treatment key off this, so it must agree
// with eventStormingKindOf on every signal — including the legacy fill.
describe('isEventStormingNote', () => {
  const el = (o: Record<string, unknown> = {}) =>
    ({ id: 'n', type: 'sticky', x: 0, y: 0, width: 200, height: 200, ...o }) as never;

  it('is a note when the kind is stamped', () => {
    expect(isEventStormingNote(el({ esKind: 'domain-event' }))).toBe(true);
  });

  it('is a note when only the canonical fill + fixed stationery says so', () => {
    expect(isEventStormingNote(el({ fixedSize: true, fillColor: '#fdba74' }))).toBe(true);
  });

  it('is not a note for an ordinary sticky that merely happens to be orange', () => {
    expect(isEventStormingNote(el({ fillColor: '#fdba74' }))).toBe(false);
    expect(isEventStormingNote(el())).toBe(false);
  });

  it('is not a note for anything that is not a sticky', () => {
    expect(isEventStormingNote(el({ type: 'shape', esKind: 'command' }))).toBe(false);
  });
});

// The notation writes in marker (docs/specs/021-event-storming/event-storming.md): the face is part of the
// grammar, like the colour, so it is resolved from the note rather than
// left to whatever font the tab happens to carry.
describe('eventStormingNoteFont', () => {
  const el = (o: Record<string, unknown> = {}) =>
    ({ id: 'n', type: 'sticky', x: 0, y: 0, width: 200, height: 200, ...o }) as never;

  it('gives a workshop note the marker face', () => {
    expect(eventStormingNoteFont(el({ esKind: 'domain-event' }))).toBe(ES_NOTE_FONT);
    expect(ES_NOTE_FONT).toBe('permanent-marker');
  });

  it('gives an ordinary element nothing (the tab default still applies)', () => {
    expect(eventStormingNoteFont(el())).toBeNull();
    expect(eventStormingNoteFont(el({ type: 'shape' }))).toBeNull();
  });
});

// Board identity as a first-class fact. It used to be inferred from a layer
// id — a proxy that meant something else, and it broke twice: first as a
// checklist (all three stage layers, so deleting one stripped the board),
// then as a single layer a facilitator can delete from the Layers panel.
// `kind` says what the tab IS.
describe('board kind', () => {
  const tabWith = (t: Partial<Tab>): Tab => ({ id: 't', name: 'T', elements: [], ...t }) as Tab;

  it('recognises a board by its kind, with no layers at all', () => {
    expect(isEventStormingTab(tabWith({ kind: 'event-storming' }))).toBe(true);
  });

  it('keeps the board even when every layer is gone', () => {
    // Deleting the layer must not silently strip the palette, the
    // stationery and the note menu.
    expect(isEventStormingTab(tabWith({ kind: 'event-storming', layers: [] }))).toBe(true);
  });

  it('still recognises boards authored before the kind existed', () => {
    for (const id of [ES_BOARD_LAYER_ID, ES_BIG_PICTURE_LAYER_ID, ES_PROCESS_LAYER_ID]) {
      expect(isEventStormingTab(tabWith({ layers: [{ id, name: 'legacy' }] }))).toBe(true);
    }
  });

  it('is not a board without either signal', () => {
    expect(isEventStormingTab(tabWith({}))).toBe(false);
    expect(isEventStormingTab(tabWith({ layers: [{ id: 'own', name: 'Sketches' }] }))).toBe(false);
    expect(isEventStormingTab(undefined)).toBe(false);
  });
});

// Changing a note's kind (docs/specs/021-event-storming/event-storming.md): a VERB on this board, because the kind is
// the notation — so it re-paints, re-cuts and stays put.
describe('changeEventStormingKind', () => {
  const note = {
    id: 'n',
    type: 'sticky',
    esKind: 'domain-event' as const,
    fixedSize: true,
    x: 1000,
    y: 500,
    width: 200,
    height: 200,
  };

  it('re-kinds, re-fills and re-cuts the silhouette', () => {
    const out = changeEventStormingKind(note, 'policy');
    expect(out).toMatchObject({ esKind: 'policy', fillColor: '#d8b4fe', width: 300, height: 180 });
  });

  it('keeps the note centred where it was', () => {
    const out = changeEventStormingKind(note, 'policy');
    expect(out.x + out.width / 2).toBe(1100);
    expect(out.y + out.height / 2).toBe(600);
  });

  it('leaves anything that is not a workshop note alone', () => {
    const plain = { ...note, esKind: undefined, fixedSize: false, fillColor: undefined };
    expect(changeEventStormingKind(plain, 'policy')).toBe(plain);
  });
});
