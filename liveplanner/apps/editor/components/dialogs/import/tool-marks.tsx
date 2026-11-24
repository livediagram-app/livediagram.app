// Each tool's mark in the Import dialog's A Board from Another Tool rows (docs/specs/026-plan/plan-tabs.md "The Import
// dialog"): the tool's own logo, white on the tool's own colour. The paths ship in the dialog's chunk (the shared
// brand-logos module), so nothing is fetched.
import type { TrackerSource } from '@liveplanner/items';
import {
  ASANA_LOGO,
  BrandLogo,
  JIRA_LOGO,
  LINEAR_LOGO,
  TRELLO_LOGO,
  type BrandLogoMark,
} from '@liveworkspace/workbench/components/dialogs/brand-logos';

// The tools' own brand colours, dark enough for a white mark on top in light and dark alike.
const TILE: Readonly<Record<TrackerSource, string>> = {
  trello: '#0C66E4',
  asana: '#E8534F',
  jira: '#1868DB',
  linear: '#5E6AD2',
};

const LOGO: Readonly<Record<TrackerSource, BrandLogoMark>> = {
  trello: TRELLO_LOGO,
  asana: ASANA_LOGO,
  jira: JIRA_LOGO,
  linear: LINEAR_LOGO,
};

// The mark on its tile, sized for an option row's icon slot.
export function ToolMark({ source }: { source: TrackerSource }) {
  return (
    <span
      className="flex h-8 w-8 items-center justify-center rounded-lg shadow-sm ring-1 ring-black/5 dark:ring-white/10"
      style={{ backgroundColor: TILE[source] }}
    >
      <BrandLogo mark={LOGO[source]} size={18} ink="#fff" />
    </span>
  );
}
