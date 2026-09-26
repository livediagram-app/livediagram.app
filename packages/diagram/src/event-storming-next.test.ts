import { describe, expect, it } from 'vitest';
import { ES_NEXT_NOTES, nextNoteBounds, nextNoteKind, nextNoteSides } from './event-storming-next';
import { ES_NOTE_GAP } from './event-storming-lanes';
import { ES_NOTE_SIZE_PX, type EventStormingNoteKind } from './event-storming';
import type { StickyElement } from './index';

function note(id: string, kind: EventStormingNoteKind, x: number, y: number): StickyElement {
  const size = ES_NOTE_SIZE_PX[kind === 'policy' ? 'wide' : 'square'];
  return {
    id,
    type: 'sticky',
    esKind: kind,
    fixedSize: true,
    x,
    y,
    width: size.width,
    height: size.height,
  } as StickyElement;
}

describe('the next-note catalogue', () => {
  it('holds the most likely next note on each side the notation has one', () => {
    expect(ES_NEXT_NOTES).toEqual([
      { kind: 'domain-event', side: 'before', next: 'command' },
      { kind: 'domain-event', side: 'after', next: 'policy' },
      { kind: 'policy', side: 'after', next: 'command' },
    ]);
  });

  it('names the next note for a side, and nothing for a side without one', () => {
    expect(nextNoteKind('domain-event', 'before')).toBe('command');
    expect(nextNoteKind('domain-event', 'after')).toBe('policy');
    expect(nextNoteKind('policy', 'after')).toBe('command');
    expect(nextNoteKind('policy', 'before')).toBeNull();
    expect(nextNoteKind('actor', 'after')).toBeNull();
  });

  it('lists the sides a note offers, in catalogue order', () => {
    expect(nextNoteSides('domain-event')).toEqual([
      { side: 'before', next: 'command' },
      { side: 'after', next: 'policy' },
    ]);
    expect(nextNoteSides('policy')).toEqual([{ side: 'after', next: 'command' }]);
    expect(nextNoteSides('command')).toEqual([]);
  });
});

describe('nextNoteBounds', () => {
  const event = note('e', 'domain-event', 1000, 500);

  it('puts a BEFORE note one gutter to the left, the same height', () => {
    const b = nextNoteBounds(event, 'before', 'command');
    expect(b).toEqual({ x: 1000 - ES_NOTE_GAP - 200, y: 500, width: 200, height: 200 });
  });

  it('puts an AFTER note one gutter to the right', () => {
    expect(nextNoteBounds(event, 'after', 'policy').x).toBe(1000 + 200 + ES_NOTE_GAP);
  });

  it('centres mixed stationery on the note rather than aligning tops', () => {
    // A 180-tall policy beside a 200-tall event: 10px of overhang each side.
    const b = nextNoteBounds(event, 'after', 'policy');
    expect(b.y + b.height / 2).toBe(event.y + event.height / 2);
  });
});
