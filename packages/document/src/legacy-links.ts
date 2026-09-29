// Element links written before the container became a document (docs/specs/006-document/document.md)
// read `{ kind: 'diagram', diagramId, name }`. Stored rows are migrated in D1; this upgrades the
// copies that can still arrive from elsewhere: exported files, offline documents, old clients.
// A link is told apart from a tab (whose kind 'diagram' is the tab kind) by its `diagramId`.

type LegacyLink = { kind: 'diagram'; diagramId: string; name?: string };

function isLegacyLink(value: Record<string, unknown>): value is LegacyLink {
  return value.kind === 'diagram' && typeof value.diagramId === 'string';
}

export function upgradeLegacyLinks<T>(value: T): T {
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      const upgraded = upgradeLegacyLinks(item);
      if (upgraded !== item) changed = true;
      return upgraded;
    });
    return (changed ? next : value) as T;
  }
  if (value === null || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  if (isLegacyLink(record)) {
    const { diagramId, kind: _kind, ...rest } = record;
    return { kind: 'document', documentId: diagramId, ...rest } as T;
  }
  let changed = false;
  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(record)) {
    const upgraded = upgradeLegacyLinks(item);
    if (upgraded !== item) changed = true;
    next[key] = upgraded;
  }
  return (changed ? next : value) as T;
}
