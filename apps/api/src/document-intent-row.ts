// The recorded creation intent as stored on a documents row (migration 0062,
// docs/specs/013-workspace/default-folders.md "Recorded intent"). Each stored value reads as itself
// only when it is in its list, so a retired value never reaches a client as a live option. The
// opens-in decides whether anything was recorded: when it reads null, so does everything else.

import { isCreationTabKind, isTemplateFamily, type RecordedIntent } from '@livediagram/api-schema';
import { isEditorMode } from '@livediagram/document';

export type RecordedIntentRow = {
  opens_in: string | null;
  tab_kind: string | null;
  template_family: string | null;
};

const UNKNOWN: RecordedIntent = { opensIn: null, tabKind: null, templateFamily: null };

export function readRecordedIntent(row: RecordedIntentRow): RecordedIntent {
  if (!isEditorMode(row.opens_in)) return UNKNOWN;
  return {
    opensIn: row.opens_in,
    tabKind: isCreationTabKind(row.tab_kind) ? row.tab_kind : null,
    templateFamily: isTemplateFamily(row.template_family) ? row.template_family : null,
  };
}
