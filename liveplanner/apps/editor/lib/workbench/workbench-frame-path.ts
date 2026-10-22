// The workspace frame's addresses as the editor worker and the e2e stack serve them
// (docs/specs/013-workspace/blueprints/workbench-embeds.md "The workspace frame", WB56). One static page backs every
// place inside the frame, as /project/placeholder backs every project: the server serves it for each frame path,
// and the page reads the real address. Every frame path sits under /embed, so it stays frameable.

export const WORKSPACE_FRAME_PAGE = '/embed/workbench/explorer';
const PROJECT_ROOT = '/embed/workbench/project';

// A frame path the static page backs that is not the page's own file.
export function isWorkspaceFramePath(pathname: string): boolean {
  return (
    pathname.startsWith(`${WORKSPACE_FRAME_PAGE}/`) ||
    pathname === PROJECT_ROOT ||
    pathname.startsWith(`${PROJECT_ROOT}/`)
  );
}
