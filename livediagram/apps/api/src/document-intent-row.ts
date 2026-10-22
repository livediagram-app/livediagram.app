// The recorded creation intent as stored on a documents row (migration 0062,
// docs/specs/013-workspace/default-folders.md "Recorded intent"). Each stored value reads as itself
// only when it is in its list, so a retired value never reaches a client as a live option. The
// opens-in decides whether anything was recorded: when it reads null, so does everything else.

import { isCreationTabKind, isTemplateFamily, type RecordedIntent } from '@livediagram/api-schema';
import { parseEditorMode } from '@livediagram/document';

export type RecordedIntentRow = {
  opens_in: string | null;
  tab_kind: string | null;
  template_family: string | null;
};

const RETIRED_MODES: ReadonlySet<string | null> = new Set(['pages', 'illustrate', 'infographic']);

const UNKNOWN: RecordedIntent = { opensIn: null, tabKind: null, templateFamily: null };

export function readRecordedIntent(row: RecordedIntentRow): RecordedIntent {
  // A document made in Pages (recorded as `pages`, or before its renames `illustrate` or `infographic`) was made as
  // something livediagram no longer makes: nothing reads as recorded, rather than Diagram, which it was not made as.
  if (RETIRED_MODES.has(row.opens_in)) return UNKNOWN;
  const opensIn = parseEditorMode(row.opens_in);
  if (!opensIn) return UNKNOWN;
  return {
    opensIn,
    tabKind: isCreationTabKind(row.tab_kind) ? row.tab_kind : null,
    templateFamily: isTemplateFamily(row.template_family) ? row.template_family : null,
  };
}
