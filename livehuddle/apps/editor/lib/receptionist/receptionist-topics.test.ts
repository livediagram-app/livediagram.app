import { describe, expect, it } from 'vitest';
import {
  RECEPTIONIST_TOPICS,
  RECEPTIONIST_TOPIC_GROUPS,
  receptionistTopicTelemetryType,
  receptionistTopicsFor,
  withTopicHeard,
} from './receptionist-topics';

// docs/specs/008-canvas/receptionist.md "The topics".

describe('The Receptionist topics', () => {
  it('has fifteen topics in five groups, unique ids', () => {
    expect(RECEPTIONIST_TOPICS).toHaveLength(15);
    expect(new Set(RECEPTIONIST_TOPICS.map((t) => t.id)).size).toBe(15);
    for (const t of RECEPTIONIST_TOPICS) expect(RECEPTIONIST_TOPIC_GROUPS).toContain(t.group);
    for (const g of RECEPTIONIST_TOPIC_GROUPS)
      expect(RECEPTIONIST_TOPICS.some((t) => t.group === g)).toBe(true);
  });

  it('never uses an em dash, and keeps each answer to one short line', () => {
    for (const t of RECEPTIONIST_TOPICS) {
      expect(`${t.title} ${t.answer}`).not.toMatch(/—/);
      expect(t.answer.length).toBeLessThanOrEqual(140);
    }
  });

  it('leaves out Say for someone who may not speak and Building for someone who may not edit', () => {
    const ids = (speak: boolean, edit: boolean) =>
      receptionistTopicsFor({ speak, edit }).map((t) => t.id);
    expect(ids(true, true)).toHaveLength(15);
    expect(ids(false, true)).not.toContain('say');
    expect(ids(true, false)).not.toContain('building');
    expect(ids(false, false)).toHaveLength(13);
  });

  it('adds a heard topic once, in order', () => {
    expect(withTopicHeard(undefined, 'rooms')).toEqual(['rooms']);
    expect(withTopicHeard(['rooms'], 'look')).toEqual(['rooms', 'look']);
    expect(withTopicHeard(['rooms'], 'rooms')).toEqual(['rooms']);
  });

  it('names its telemetry token in PascalCase', () => {
    expect(receptionistTopicTelemetryType('getting-around')).toBe('ReceptionistTopicGettingAround');
    expect(receptionistTopicTelemetryType('rooms')).toBe('ReceptionistTopicRooms');
  });
});
