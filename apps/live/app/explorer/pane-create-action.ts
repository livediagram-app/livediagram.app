// Which shape the Explorer header's create affordance takes (docs/specs/013-workspace/folders.md).
//
// Two actions (New document + New subfolder, inside a folder) share one
// compact "+ Create" dropdown: two shrink-0 buttons squeezed the folder-name
// title to nothing on a narrow phone. But a dropdown holding a single tile is
// two clicks and a hidden label for one action — it reads as "Create… what?".
// So a section offering exactly one create action renders that action
// directly, named. Sections offering neither render nothing.
//
// Kept pure and separate from PaneHeader.tsx so the branch is unit-testable
// without mounting the header (docs/specs/003-system-architecture/testing.md).

export type PaneCreateMode =
  { kind: 'none' } | { kind: 'menu' } | { kind: 'single'; action: 'document' | 'folder' };

export function paneCreateMode(opts: {
  hasCreateDocument: boolean;
  hasCreateFolder: boolean;
}): PaneCreateMode {
  const { hasCreateDocument, hasCreateFolder } = opts;
  if (hasCreateDocument && hasCreateFolder) return { kind: 'menu' };
  if (hasCreateDocument) return { kind: 'single', action: 'document' };
  if (hasCreateFolder) return { kind: 'single', action: 'folder' };
  return { kind: 'none' };
}
