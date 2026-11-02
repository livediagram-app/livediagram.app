// A document's own page in the editor (the router serves the editor at /document/<id>).
export function documentPath(documentId: string): string {
  return `/document/${encodeURIComponent(documentId)}`;
}
