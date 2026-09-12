import { describe, expect, it } from 'vitest';
import type { Tab } from './index';
import { isLayerVisible, type Layer } from './layers';
import {
  applyEventStormingStage,
  eventStormingNoteSize,
  eventStormingTilt,
  ES_MAX_TILT_DEG,
  ES_BIG_PICTURE_LAYER_ID,
  ES_DESIGN_LAYER_ID,
  ES_PROCESS_LAYER_ID,
  EVENT_STORMING_NOTES,
  EVENT_STORMING_STAGES,
  eventStormingLayers,
  eventStormingNote,
  eventStormingStageLayerId,
  eventStormingStageOf,
  isEventStormingTab,
  type EventStormingNoteKind,
} from './event-storming';

// The event-storming sticky grammar (spec/139): colour IS the notation, so
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
    // (spec/139): events, actors and hotspots surface in Big picture;
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

  it('eventStormingStageLayerId maps a kind to its stage layer', () => {
    expect(eventStormingStageLayerId('domain-event')).toBe(ES_BIG_PICTURE_LAYER_ID);
    expect(eventStormingStageLayerId('command')).toBe(ES_PROCESS_LAYER_ID);
    expect(eventStormingStageLayerId('aggregate')).toBe(ES_DESIGN_LAYER_ID);
  });

  it('eventStormingNote resolves every kind', () => {
    for (const kind of ALL_KINDS) {
      expect(eventStormingNote(kind).kind).toBe(kind);
    }
  });
});

// The workshop-stage views (spec/139): shared layer-visibility presets over
// the spec/74 layers the template ships. Switching stage = one tab commit
// that sets each stage layer's visibility; the rail is an independent
// see-it-against-a-timeline toggle. Everything here is pure Tab -> Tab.
describe('event-storming views', () => {
  const esTab = (): Tab =>
    ({ id: 't', name: 'T', elements: [], layers: eventStormingLayers() }) as unknown as Tab;

  const visibleIds = (tab: Tab) =>
    (tab.layers ?? []).filter((l: Layer) => isLayerVisible(l)).map((l: Layer) => l.id);

  it('ships the three stage layers, all visible', () => {
    const layers = eventStormingLayers();
    expect(layers.map((l) => l.id)).toEqual([
      ES_BIG_PICTURE_LAYER_ID,
      ES_PROCESS_LAYER_ID,
      ES_DESIGN_LAYER_ID,
    ]);
    // All visible: a fresh board shows everything an editor drops,
    // whatever stage chip they later press.
    expect(layers.every((l) => isLayerVisible(l))).toBe(true);
  });

  it('recognises an event-storming tab by its stage layers', () => {
    expect(isEventStormingTab(esTab().layers)).toBe(true);
    expect(isEventStormingTab(undefined)).toBe(false);
    expect(isEventStormingTab([{ id: 'layer:default', name: 'Layer 1' }])).toBe(false);
  });

  it('survives a user editing the layer stack — ANY stage layer still means ES', () => {
    // Board-ness is an identity, not a checklist: layers are ordinary
    // spec/74 data a facilitator can rename, delete or add to mid-workshop.
    // Requiring all three meant deleting one silently stripped the board of
    // its palette, its view bar and its note routing.
    const deletedDesign = eventStormingLayers().filter((l) => l.id !== ES_DESIGN_LAYER_ID);
    expect(isEventStormingTab(deletedDesign)).toBe(true);
    // Plus a layer of their own alongside — still an ES board.
    expect(isEventStormingTab([{ id: 'own-layer', name: 'Cart Emptied' }, ...deletedDesign])).toBe(
      true,
    );
    // Only the Big picture band left is still the workshop.
    expect(isEventStormingTab([{ id: ES_BIG_PICTURE_LAYER_ID, name: 'Big picture' }])).toBe(true);
    // A board with none of them is not.
    expect(isEventStormingTab([{ id: 'own-layer', name: 'Sketches' }])).toBe(false);
  });

  it('stages reveal cumulatively: big-picture ⊆ process ⊆ design', () => {
    const tab = esTab();
    const big = applyEventStormingStage(tab, 'big-picture');
    expect(visibleIds(big)).toEqual([ES_BIG_PICTURE_LAYER_ID]);
    const process = applyEventStormingStage(tab, 'process');
    expect(visibleIds(process)).toEqual([ES_BIG_PICTURE_LAYER_ID, ES_PROCESS_LAYER_ID]);
    const design = applyEventStormingStage(tab, 'design');
    expect(visibleIds(design)).toEqual([
      ES_BIG_PICTURE_LAYER_ID,
      ES_PROCESS_LAYER_ID,
      ES_DESIGN_LAYER_ID,
    ]);
  });

  it('derives the current stage from visibility (deepest visible stage wins)', () => {
    const tab = esTab();
    expect(eventStormingStageOf(applyEventStormingStage(tab, 'big-picture').layers)).toBe(
      'big-picture',
    );
    expect(eventStormingStageOf(applyEventStormingStage(tab, 'process').layers)).toBe('process');
    expect(eventStormingStageOf(applyEventStormingStage(tab, 'design').layers)).toBe('design');
    // A fresh board (everything visible) reads as design — the all-in view.
    expect(eventStormingStageOf(esTab().layers)).toBe('design');
  });

  it('EVENT_STORMING_STAGES orders the chips shallow to deep with labels + active layer', () => {
    expect(EVENT_STORMING_STAGES.map((s) => s.stage)).toEqual(['big-picture', 'process', 'design']);
    expect(EVENT_STORMING_STAGES.map((s) => s.layerId)).toEqual([
      ES_BIG_PICTURE_LAYER_ID,
      ES_PROCESS_LAYER_ID,
      ES_DESIGN_LAYER_ID,
    ]);
    for (const s of EVENT_STORMING_STAGES) expect(s.label.length).toBeGreaterThan(0);
  });
});

// A copied workshop note is a NEW piece of paper: it gets its own id and its
// own hand-placement (spec/139). Keeping the source's exact tilt made a
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
