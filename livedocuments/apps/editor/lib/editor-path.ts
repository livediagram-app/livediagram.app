// The editor route is /document/<id> (docs/specs/016-platform/router-app.md).

export function isEditorPath(pathname: string): boolean {
  return pathname === '/document' || pathname.startsWith('/document/');
}

// The document id on the editor path; `placeholder` (the static-export build artefact) is never one.
export function documentIdFromPath(pathname: string): string | null {
  const match = /^\/document\/([^/?#]+)/.exec(pathname);
  if (!match || match[1] === 'placeholder') return null;
  return match[1]!;
}
