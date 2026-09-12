import { describe, expect, it } from 'vitest';
import {
  EVENT_STORMING_NOTES,
  eventStormingNote,
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

  it('eventStormingNote resolves every kind', () => {
    for (const kind of ALL_KINDS) {
      expect(eventStormingNote(kind).kind).toBe(kind);
    }
  });
});
