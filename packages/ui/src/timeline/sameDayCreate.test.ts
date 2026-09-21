import { describe, expect, it } from 'vitest';
import { collapseSameDayCreate } from './sameDayCreate';
import type { TimelineEvent } from './types';

// Local noon, so a same-day pair can't straddle midnight in any zone the
// suite runs in.
const NOON = new Date(2026, 8, 21, 12, 0, 0).getTime();
const HOUR = 60 * 60 * 1000;

function event(over: Partial<TimelineEvent> & { id: string }): TimelineEvent {
  return {
    sourceType: 'diagram',
    sourceId: 'd1',
    eventType: 'diagram_edited',
    title: 'Diagram Updated',
    description: null,
    occurredAt: NOON,
    actorId: 'me',
    snapshot: { diagramId: 'd1', diagramName: 'Payments' },
    ...over,
  } as TimelineEvent;
}

describe('collapseSameDayCreate', () => {
  it('drops the edit that shares a local day with its create', () => {
    const create = event({ id: 'c', eventType: 'diagram_created', title: 'Diagram Created' });
    const edit = event({ id: 'e', occurredAt: NOON + 3 * HOUR });
    // Newest first, as the feed arrives.
    expect(collapseSameDayCreate([edit, create]).map((e) => e.id)).toEqual(['c']);
  });

  it('keeps an edit on a later day', () => {
    const create = event({ id: 'c', eventType: 'diagram_created', title: 'Diagram Created' });
    const edit = event({ id: 'e', occurredAt: NOON + 24 * HOUR });
    expect(collapseSameDayCreate([edit, create]).map((e) => e.id)).toEqual(['e', 'c']);
  });

  it('keys on the diagram, not the day alone', () => {
    const create = event({ id: 'c', eventType: 'diagram_created', title: 'Diagram Created' });
    const other = event({ id: 'e', snapshot: { diagramId: 'd2', diagramName: 'Other' } });
    expect(collapseSameDayCreate([other, create]).map((e) => e.id)).toEqual(['e', 'c']);
  });

  it('leaves every other same-day kind alone', () => {
    const create = event({ id: 'c', eventType: 'diagram_created', title: 'Diagram Created' });
    const rename = event({ id: 'r', eventType: 'diagram_renamed', title: 'Diagram Renamed' });
    const comment = event({ id: 'm', eventType: 'comment_added', title: 'Comment Added' });
    expect(collapseSameDayCreate([comment, rename, create]).map((e) => e.id)).toEqual([
      'm',
      'r',
      'c',
    ]);
  });

  it('keeps an edit whose snapshot names no diagram', () => {
    const create = event({ id: 'c', eventType: 'diagram_created', title: 'Diagram Created' });
    const edit = event({ id: 'e', snapshot: {} });
    expect(collapseSameDayCreate([edit, create]).map((e) => e.id)).toEqual(['e', 'c']);
  });

  it('is a no-op copy when nothing was created', () => {
    const edit = event({ id: 'e' });
    const out = collapseSameDayCreate([edit]);
    expect(out).toEqual([edit]);
  });
});
