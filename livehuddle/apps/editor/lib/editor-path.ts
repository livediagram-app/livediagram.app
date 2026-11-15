// The editor route, /document/<id> (docs/specs/016-platform/router-app.md). The router sends the old
// /diagram/<id> address on to it, so the editor answers only this one.
const EDITOR = '/document';

export function isEditorPath(pathname: string): boolean {
  return pathname === EDITOR || pathname.startsWith(`${EDITOR}/`);
}

/** The document id the editor's address names, or null (the static placeholder, or any other path). */
export function documentIdFromPath(pathname: string): string | null {
  const match = /^\/document\/([^/?#]+)/.exec(pathname);
  if (!match || match[1] === 'placeholder') return null;
  return match[1]!;
}
