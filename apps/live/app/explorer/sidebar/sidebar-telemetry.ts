import { track } from '@/lib/telemetry';

// Which sidebar row was activated (docs/specs/013-workspace/explorer-structure.md#telemetry): a
// closed set of row kinds, never a team, folder or document name.
export type SidebarTelemetryRow =
  | 'Home'
  | 'Activity'
  | 'SharedWithMe'
  | 'MyDocuments'
  | 'Unsorted'
  | 'Generated'
  | 'Folder'
  | 'Team'
  | 'TeamFolder'
  | 'Invites'
  | 'NewTeam'
  | 'ThisBrowser'
  | 'Library'
  | 'ImageGallery'
  | 'Themes'
  | 'ShapeLibraries'
  | 'Trash';

export function trackSidebar(row: SidebarTelemetryRow): void {
  track('UI', 'Selected', `Sidebar.${row}`);
}
