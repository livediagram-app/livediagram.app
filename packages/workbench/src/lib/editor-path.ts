// The editor route of the products whose items are documents, /document/<id> (livediagram and livehuddle,
// docs/specs/016-platform/router-app.md in each). The router sends livediagram's old /diagram/<id> address on to it,
// and livehuddle never had one, so the editor answers only this one.
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
