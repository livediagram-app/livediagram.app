import { track } from '@/lib/telemetry';

// Which sidebar row was activated (docs/specs/013-workspace/explorer-structure.md#telemetry): a
// closed set of row kinds, never a team, folder or document name. The editor's floating
// Explorer panel builds the same rows and reports them under its own prefix.
export type SidebarTelemetryRow =
  | 'Home'
  | 'Inbox'
  | 'Timeline'
  | 'SharedWithMe'
  | 'MyDocuments'
  | 'Folder'
  | 'Team'
  | 'TeamFolder'
  | 'Invites'
  | 'NewTeam'
  | 'ThisBrowser'
  | 'Library'
  | 'ImageGallery'
  | 'Tags'
  | 'Tag'
  | 'Trash'
  // A document or folder dropped on the Trash row (explorer-structure.md "Dragging to the Trash").
  | 'TrashDropDocument'
  | 'TrashDropFolder';

const SIDEBAR_TELEMETRY_PREFIX = { page: 'Sidebar', panel: 'ExplorerPanel' } as const;

export function trackSidebar(row: SidebarTelemetryRow, surface: 'page' | 'panel' = 'page'): void {
  track('UI', 'Selected', `${SIDEBAR_TELEMETRY_PREFIX[surface]}.${row}`);
}
