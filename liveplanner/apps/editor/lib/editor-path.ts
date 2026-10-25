// The editor route, /project/<id> (docs/specs/016-platform/router-app.md).
const EDITOR = 'project';

export function isEditorPath(pathname: string): boolean {
  return pathname === `/${EDITOR}` || pathname.startsWith(`/${EDITOR}/`);
}

// A share link's own address, `/project/shared?s=<code>`: the code names the plan, so the path names none
// (docs/specs/013-workspace/share-link-previews.md). It is the address the Share dialog copies, because its page
// head names the plan.
export const SHARED_PATH_SEGMENT = 'shared';

// The plan id an editor address names, or null (the static-export placeholder, a share link's address, any other
// page).
export function projectIdFromPath(pathname: string): string | null {
  const match = /^\/project\/([^/?#]+)/.exec(pathname);
  if (!match || match[1] === 'placeholder' || match[1] === SHARED_PATH_SEGMENT) return null;
  return match[1]!;
}
