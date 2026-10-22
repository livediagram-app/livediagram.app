// Which shape the Explorer header's create affordance takes (docs/specs/013-workspace/folders.md).
//
// Two actions (New project + New subfolder, inside a folder) share one
// compact "+ Create" dropdown: two shrink-0 buttons squeezed the folder-name
// title to nothing on a narrow phone. But a dropdown holding a single tile is
// two clicks and a hidden label for one action — it reads as "Create… what?".
// So a section offering exactly one create action renders that action
// directly, named. Sections offering neither render nothing.
//
// Kept pure and separate from PaneHeader.tsx so the branch is unit-testable
// without mounting the header (docs/specs/003-system-architecture/testing.md).

type PaneCreateMode =
  { kind: 'none' } | { kind: 'menu' } | { kind: 'single'; action: 'project' | 'folder' };

export function paneCreateMode(opts: {
  hasCreateProject: boolean;
  hasCreateFolder: boolean;
}): PaneCreateMode {
  const { hasCreateProject, hasCreateFolder } = opts;
  if (hasCreateProject && hasCreateFolder) return { kind: 'menu' };
  if (hasCreateProject) return { kind: 'single', action: 'project' };
  if (hasCreateFolder) return { kind: 'single', action: 'folder' };
  return { kind: 'none' };
}
