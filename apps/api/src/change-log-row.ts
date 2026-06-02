import type { ChangeLogEntry as ChangeLogEntryDTO, ChangeLogKind } from '@livediagram/api-schema';

// change_log row shape as read from D1. LEFT-joins to `participants`
// surface null name / colour when the writer's participant row was
// deleted (sign-out cleanup, account delete). The denormalised
// columns went away with migration 0013 (item #15), so the API
// resolves the display fields at read time and falls back here.

export type ChangeLogRow = {
  id: string;
  tab_id: string | null;
  participant_id: string;
  participant_name: string | null;
  participant_color: string | null;
  kind: string;
  summary: string;
  element_ids: string;
  before_state: string;
  after_state: string;
  created_at: number;
};

// Fallback display values for change_log rows whose participant has
// been deleted since the entry was written. Leaving these undefined
// would mean the activity panel renders blank rows; the slate-400
// neutral colour matches what the UI shows for any unknown peer.
export const UNKNOWN_PARTICIPANT_NAME = 'Unknown';
export const UNKNOWN_PARTICIPANT_COLOR = '#94a3b8';

// Pure mapper from D1 row to wire-format DTO. Pulled out of db.ts
// so the participant-deleted fallback contract has a test surface
// of its own without dragging the rest of the D1 module along.
export function rowToChangeLog(row: ChangeLogRow): ChangeLogEntryDTO {
  return {
    id: row.id,
    tabId: row.tab_id,
    participantId: row.participant_id,
    participantName: row.participant_name ?? UNKNOWN_PARTICIPANT_NAME,
    participantColor: row.participant_color ?? UNKNOWN_PARTICIPANT_COLOR,
    kind: (row.kind as ChangeLogKind) ?? 'edit',
    summary: row.summary,
    elementIds: JSON.parse(row.element_ids),
    beforeState: JSON.parse(row.before_state),
    afterState: JSON.parse(row.after_state),
    createdAt: row.created_at,
  };
}
