// The workspace frame's addresses as the live worker and the e2e stack serve them
// (docs/specs/013-workspace/blueprints/workbench-embeds.md "The workspace frame", WB56). One static page backs every
// place inside the frame, as /document/placeholder backs every document: the server serves it for each frame path,
// and the page reads the real address. Every frame path sits under /embed, so it stays frameable.

export const WORKSPACE_FRAME_PAGE = '/embed/workbench/explorer';
const DOCUMENT_ROOT = '/embed/workbench/document';

// A frame path the static page backs that is not the page's own file.
export function isWorkspaceFramePath(pathname: string): boolean {
  return (
    pathname.startsWith(`${WORKSPACE_FRAME_PAGE}/`) ||
    pathname === DOCUMENT_ROOT ||
    pathname.startsWith(`${DOCUMENT_ROOT}/`)
  );
}
