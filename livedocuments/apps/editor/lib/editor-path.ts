// The editor route is /document/<id> (docs/specs/016-platform/router-app.md).

export function isEditorPath(pathname: string): boolean {
  return pathname === '/document' || pathname.startsWith('/document/');
}

// The document id on the editor path; `placeholder` (the static-export build artefact) is never one, nor is
// `shared`: a share link's own address (`/document/shared?s=<code>`) names no document, its code does.
export function documentIdFromPath(pathname: string): string | null {
  const match = /^\/document\/([^/?#]+)/.exec(pathname);
  if (!match || match[1] === 'placeholder' || match[1] === 'shared') return null;
  return match[1]!;
}
