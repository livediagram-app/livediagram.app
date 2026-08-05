// Which shape the Explorer header's create affordance takes (spec/15).
//
// Two actions (New diagram + New subfolder, inside a folder) share one
// compact "+ Create" dropdown: two shrink-0 buttons squeezed the folder-name
// title to nothing on a narrow phone. But a dropdown holding a single tile is
// two clicks and a hidden label for one action — it reads as "Create… what?".
// So a section offering exactly one create action renders that action
// directly, named. Sections offering neither render nothing.
//
// Kept pure and separate from PaneHeader.tsx so the branch is unit-testable
// without mounting the header (spec/18).

export type PaneCreateMode =
  { kind: 'none' } | { kind: 'menu' } | { kind: 'single'; action: 'diagram' | 'folder' };

export function paneCreateMode(opts: {
  hasCreateDiagram: boolean;
  hasCreateFolder: boolean;
}): PaneCreateMode {
  const { hasCreateDiagram, hasCreateFolder } = opts;
  if (hasCreateDiagram && hasCreateFolder) return { kind: 'menu' };
  if (hasCreateDiagram) return { kind: 'single', action: 'diagram' };
  if (hasCreateFolder) return { kind: 'single', action: 'folder' };
  return { kind: 'none' };
}
