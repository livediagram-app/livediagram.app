// The knowledge routes' paths (docs/specs/015-api/api.md "Knowledge"): `/documents/<id>` and what follows, each part
// encoded, since a page may be named by its title.
export const knowledgePath = (documentId: string, ...parts: string[]) =>
  `/documents/${[documentId, ...parts].map(encodeURIComponent).join('/')}`;

/** A JSON body for a write. */
export const jsonBody = (method: 'POST' | 'PUT', body: unknown): RequestInit => ({
  method,
  body: JSON.stringify(body),
});
