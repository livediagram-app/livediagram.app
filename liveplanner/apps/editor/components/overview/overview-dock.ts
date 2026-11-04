// The dock's Style button (docs/specs/026-plan/plan-overview.md "The dock", "Style"): on a tab it opens Tab Style for
// whoever may style the tab; while the Overview is open it opens Overview Style, an Editor's only (a Participant or
// Viewer has no Style there). Light, so the editor's canvas host reads it without loading the Overview.
import type { CanvasThemeTab } from '@/components/dialogs/CanvasThemeDialog';
import { track } from '@/lib/telemetry';

export function overviewStyleOpener(
  session: { overviewOpen: boolean; canEdit: boolean; readOnly: boolean; embedMode: boolean },
  open: (tab: CanvasThemeTab) => void,
): (() => void) | undefined {
  if (session.embedMode) return undefined;
  if (session.overviewOpen)
    return session.canEdit
      ? () => {
          open('looks');
          track('UI', 'Opened', 'OverviewStyle');
        }
      : undefined;
  return session.readOnly
    ? undefined
    : () => {
        open('looks');
        track('UI', 'Opened', 'ThemePicker');
      };
}
