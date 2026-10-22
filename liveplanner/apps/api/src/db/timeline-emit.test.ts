// emitTimelineEvent (docs/specs/013-workspace/timeline.md §4.2) against the real migrations: one batch writes the
// event and attaches its scopes, and a repeat of the same event coalesces onto the original row, whose id the
// repeat never generated, adding any new scope to it.
import { describe, expect, it, vi } from 'vitest';
import { sqliteD1 } from '../test-sqlite-d1';
import { emitTimelineEvent } from './timeline';

const draft = (description: string) => ({
  actorId: 'ada',
  sourceType: 'project' as const,
  sourceId: 'd1',
  eventType: 'project_edited' as const,
  dedupeKey: 'ada:2026-10-11',
  title: 'Edited',
  description,
  snapshot: { projectId: 'd1' },
});

describe('emitTimelineEvent', () => {
  it('writes the event and its scopes in one batch, and coalesces a repeat onto the original row', async () => {
    const { env, sql } = sqliteD1();
    const batch = vi.spyOn(env.DB, 'batch');
    await emitTimelineEvent(env, draft('First'), [{ scopeType: 'user', scopeId: 'ada' }]);
    await emitTimelineEvent(env, draft('Renamed'), [
      { scopeType: 'user', scopeId: 'ada' },
      { scopeType: 'project', scopeId: 'd1' },
    ]);
    expect(batch).toHaveBeenCalledTimes(2);
    const events = sql.prepare('SELECT id, description FROM timeline_events').all();
    expect(events).toHaveLength(1);
    expect(events[0]!['description']).toBe('Renamed');
    const scopes = sql
      .prepare(
        'SELECT event_id, scope_type, scope_id FROM timeline_event_scopes ORDER BY scope_type',
      )
      .all()
      .map((r) => [r['event_id'], r['scope_type'], r['scope_id']]);
    expect(scopes).toEqual([
      [events[0]!['id'], 'project', 'd1'],
      [events[0]!['id'], 'user', 'ada'],
    ]);
  });
});
