// Request forms an old client can still send outside the /api/diagrams alias, accepted until the
// sunset (docs/specs/015-api/public-api-and-tokens.md §3.8): the timeline's `diagram:<id>` scope
// and a `diagramId` in the team notification bodies.

export function upgradeLegacyScope(raw: string): string {
  return raw.startsWith('diagram:') ? `document:${raw.slice('diagram:'.length)}` : raw;
}

export function legacyDocumentIdOf(body: unknown): string {
  const value =
    body && typeof body === 'object' ? (body as { diagramId?: unknown }).diagramId : undefined;
  return typeof value === 'string' ? value : '';
}
