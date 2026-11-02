// How a tab's folder membership change gets reported to telemetry (docs/specs/006-document/tab-folders.md + docs/specs/017-telemetry/telemetry.md).
//
// Its own module because there are TWO code paths to the same outcome: the
// ellipsis menu (useTabFolders) and a drag that adopts the drop target's
// membership (useTabActions.reorderTabs). They had drifted: leaving a folder
// by menu recorded `Tab·Removed`, leaving it by drag recorded
// `Tab·Reordered`. Which control someone reached for is not the fact being measured, so
// one decision point now serves both.

import { track } from '@/lib/telemetry';

// Telemetry for a transition.
//
// The subject is the TAB (it is the thing that moved), so these stay in the
// `Tab` category with `type: 'Folder'` naming what kind of move it was. That
// type is load-bearing rather than decorative: a dashboard metric card selects
// rows by exact `type` match, and `null` is a value — so the untyped
// `Tab·Created` these calls used to emit for a new folder was landing in the
// headline "Tabs Created" card, inflating a count of tabs with a count of
// folders. `Tab·Renamed` did the same to "Tabs Renamed".
//
// Folder lifecycle (created / renamed) is reported separately by the caller
// under the `Folder` category, where the folder is the subject.
export function trackTabFolderTransition(from: string | null, to: string | null): void {
  if (from === to) return;
  track('Tab', to !== null ? 'Moved' : 'Removed', 'Folder');
}
