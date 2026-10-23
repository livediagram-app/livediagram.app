// A `diagramId` in the team notification bodies, a request form an old client can still send
// (docs/specs/015-api/public-api-and-tokens.md §3.8).

export function legacyDocumentIdOf(body: unknown): string {
  const value =
    body && typeof body === 'object' ? (body as { diagramId?: unknown }).diagramId : undefined;
  return typeof value === 'string' ? value : '';
}
