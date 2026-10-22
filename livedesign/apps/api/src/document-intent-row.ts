// The recorded creation intent as stored on a documents row (the baseline migration,
// docs/specs/013-workspace/default-folders.md "Recorded intent"). Each stored value reads as itself
// only when it is in its list, so a retired value never reaches a client as a live option. The
// opens-in decides whether anything was recorded: when it reads null, so does the tab kind.

import { isCreationTabKind, type RecordedIntent } from '@livedesign/api-schema';
import { parseEditorMode } from '@livedesign/document';

export type RecordedIntentRow = {
  opens_in: string | null;
  tab_kind: string | null;
};

const UNKNOWN: RecordedIntent = { opensIn: null, tabKind: null };

export function readRecordedIntent(row: RecordedIntentRow): RecordedIntent {
  const opensIn = parseEditorMode(row.opens_in);
  if (!opensIn) return UNKNOWN;
  return {
    opensIn,
    tabKind: isCreationTabKind(row.tab_kind) ? row.tab_kind : null,
  };
}
