import { describe, expect, it } from 'vitest';
import {
  rowToChangeLog,
  UNKNOWN_PARTICIPANT_COLOR,
  UNKNOWN_PARTICIPANT_NAME,
  type ChangeLogRow,
} from './change-log-row';

// `rowToChangeLog` is the read-side mapper for the per-diagram
// activity log. The participant_name / participant_color columns
// arrive as null whenever the writer's participants row was deleted
// (sign-out cleanup, account delete), and the API must fill in
// sensible defaults so the Activity Panel doesn't render blank
// rows. Migration 0013 dropped the denormalised columns the worker
// previously stored alongside each entry, so this fallback is the
// only thing keeping old log rows readable after the participant
// signs out: a regression here would leave every "by Unknown" row
// blank (or NaN-coloured) for live users on the explorer.

function baseRow(over: Partial<ChangeLogRow> = {}): ChangeLogRow {
  // Build a row with everything filled in so each test only varies
  // the field under inspection. JSON strings round-trip through
  // JSON.parse inside rowToChangeLog, so the literals here look the
  // way they would coming off D1.
  return {
    id: 'log-1',
    tab_id: 'tab-1',
    participant_id: 'p-1',
    participant_name: 'Wendy',
    participant_color: '#ff0066',
    kind: 'edit',
    summary: 'Renamed shape',
    element_ids: '["el-1"]',
    before_state: '{"el-1":{"name":"old"}}',
    after_state: '{"el-1":{"name":"new"}}',
    created_at: 1717000000000,
    ...over,
  };
}

describe('rowToChangeLog', () => {
  it('maps every column to its DTO field shape', async () => {
    const dto = rowToChangeLog(baseRow());
    expect(dto.id).toBe('log-1');
    expect(dto.tabId).toBe('tab-1');
    expect(dto.participantId).toBe('p-1');
    expect(dto.participantName).toBe('Wendy');
    expect(dto.participantColor).toBe('#ff0066');
    expect(dto.kind).toBe('edit');
    expect(dto.summary).toBe('Renamed shape');
    expect(dto.elementIds).toEqual(['el-1']);
    expect(dto.beforeState).toEqual({ 'el-1': { name: 'old' } });
    expect(dto.afterState).toEqual({ 'el-1': { name: 'new' } });
    expect(dto.createdAt).toBe(1717000000000);
  });

  it('falls back to UNKNOWN_PARTICIPANT_NAME when participant_name is null', async () => {
    // The participants row was deleted but the change_log entry
    // survives (cascade rules deliberately keep audit history). The
    // DTO must not surface null or an empty string here.
    const dto = rowToChangeLog(baseRow({ participant_name: null }));
    expect(dto.participantName).toBe(UNKNOWN_PARTICIPANT_NAME);
    expect(dto.participantName).toBe('Unknown');
  });

  it('falls back to UNKNOWN_PARTICIPANT_COLOR when participant_color is null', async () => {
    const dto = rowToChangeLog(baseRow({ participant_color: null }));
    expect(dto.participantColor).toBe(UNKNOWN_PARTICIPANT_COLOR);
    // slate-400 hex: keeps the avatar bubble neutral rather than
    // letting it crash on a missing/NaN colour value in the UI.
    expect(dto.participantColor).toBe('#94a3b8');
  });

  it('still maps the rest of the row when both participant fields are null', async () => {
    const dto = rowToChangeLog(
      baseRow({ participant_name: null, participant_color: null, participant_id: 'orphan' }),
    );
    expect(dto.participantId).toBe('orphan');
    expect(dto.participantName).toBe(UNKNOWN_PARTICIPANT_NAME);
    expect(dto.participantColor).toBe(UNKNOWN_PARTICIPANT_COLOR);
    expect(dto.summary).toBe('Renamed shape');
  });

  it('parses JSON-encoded elementIds, beforeState, afterState', async () => {
    // Round-tripping JSON is the most fragile part: D1 stores these
    // as TEXT and the mapper has to lift them back into structured
    // values for the DTO. Empty array + empty object are common
    // shapes (tab-meta entries) and must parse cleanly.
    const empty = rowToChangeLog(
      baseRow({ element_ids: '[]', before_state: '{}', after_state: '{}' }),
    );
    expect(empty.elementIds).toEqual([]);
    expect(empty.beforeState).toEqual({});
    expect(empty.afterState).toEqual({});

    // Multi-element entries (a multi-select drag, a paste) carry a
    // non-trivial elementIds array.
    const multi = rowToChangeLog(baseRow({ element_ids: '["a","b","c"]' }));
    expect(multi.elementIds).toEqual(['a', 'b', 'c']);
  });

  it('preserves a null tab_id (tab-deleted entry, or a future diagram-level row)', async () => {
    // tab_id is nullable in the schema (tab cascade deletes leave
    // the row in place but null the FK in some migration paths).
    // The DTO must surface null, not coerce it to "" or "null".
    const dto = rowToChangeLog(baseRow({ tab_id: null }));
    expect(dto.tabId).toBeNull();
  });
});
