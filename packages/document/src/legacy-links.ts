// Element links written before the container became a document (docs/specs/006-document/document.md)
// read `{ kind: 'diagram', diagramId, name }`. Stored rows are migrated in D1; this upgrades the
// copies that can still arrive from elsewhere: exported files, offline documents, old clients.
// A link is told apart from a tab (whose kind 'diagram' is the tab kind) by its `diagramId`.

// Also heals the half-renamed form {kind:'diagram', documentId} that a key-only rename leaves.
function legacyLinkTarget(value: Record<string, unknown>): string | null {
  if (value.kind !== 'diagram') return null;
  if (typeof value.diagramId === 'string') return value.diagramId;
  if (typeof value.documentId === 'string') return value.documentId;
  return null;
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
  const target = legacyLinkTarget(record);
  if (target !== null) {
    const { diagramId: _old, documentId: _new, kind: _kind, ...rest } = record;
    return { kind: 'document', documentId: target, ...rest } as T;
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

// The reverse, for a client that still speaks the old names (the deprecated api alias): a
// current link {kind: "document", documentId} becomes {kind: "diagram", diagramId}.
export function downgradeLinks<T>(value: T): T {
  if (Array.isArray(value)) return value.map((item) => downgradeLinks(item)) as T;
  if (value === null || typeof value !== 'object') return value;
  const record = value as Record<string, unknown>;
  if (record.kind === 'document' && typeof record.documentId === 'string') {
    const { documentId, kind: _kind, ...rest } = record;
    return { kind: 'diagram', diagramId: documentId, ...rest } as T;
  }
  return Object.fromEntries(Object.entries(record).map(([k, v]) => [k, downgradeLinks(v)])) as T;
}
