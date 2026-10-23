// A `diagramId` an old client can still send in the team notification bodies, accepted until the sunset
// (docs/specs/015-api/public-api-and-tokens.md §3.8). Kept only because the team routes that read it belong to
// another change; it goes with them.

export function legacyDesignIdOf(body: unknown): string {
  const value =
    body && typeof body === 'object' ? (body as { diagramId?: unknown }).diagramId : undefined;
  return typeof value === 'string' ? value : '';
}
