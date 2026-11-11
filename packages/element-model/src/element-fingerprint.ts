// An element's fingerprint (docs/specs/024-agents/agent-changesets.md "What a changeset is"): what
// an agent says it read, what a changeset found and left, compared to tell whether anybody changed
// the element since. The api, the MCP and the CLI call this one function, so a fingerprint taken
// on one side matches one taken on the other.
//
// It covers the element without its live multi-writer fields (each product's LIVE_ELEMENT_FIELDS, in its
// comments.ts: comments, answers, ideas and the like) and without checklist ticks: people change those through
// deltas that never conflict with an agent's edit. Each product binds the pair to its own live fields with
// `fingerprintsFor` in its element-fingerprint.ts.

export const ELEMENT_FINGERPRINT_LENGTH = 16;

/** A product's fingerprint pair, over the live fields it leaves out. */
export type ElementFingerprints = {
  /** The JSON of the element without its live fields: object keys sorted at every depth, array order kept,
   *  `undefined` dropped (as JSON.stringify drops it). */
  canonicalElementJson: (element: object) => string;
  /** 16 lowercase hex characters: two 32-bit FNV-1a lanes with different offset bases over the canonical JSON's
   *  UTF-8 bytes (CS6). Synchronous, so every caller can use it inline. */
  elementFingerprint: (element: object) => string;
};

/** The fingerprint pair over `liveFields`, the fields a product's undo and fingerprint leave out. */
export function fingerprintsFor(liveFields: readonly string[]): ElementFingerprints {
  const live: ReadonlySet<string> = new Set(liveFields);
  const canonicalElementJson = (element: object): string => {
    const record = element as Record<string, unknown>;
    const authored: Record<string, unknown> = {};
    for (const key of Object.keys(record)) {
      if (live.has(key)) continue;
      authored[key] = key === 'checklistItems' ? withoutTicks(record[key]) : record[key];
    }
    return canonicalJson(authored);
  };
  const elementFingerprint = (element: object): string => {
    const bytes = new TextEncoder().encode(canonicalElementJson(element));
    return hex32(fnv1a(bytes, 0x811c9dc5)) + hex32(fnv1a(bytes, 0x050c5d1f));
  };
  return { canonicalElementJson, elementFingerprint };
}

function withoutTicks(items: unknown): unknown {
  if (!Array.isArray(items)) return items;
  const list: readonly unknown[] = items;
  return list.map((item) => {
    if (!item || typeof item !== 'object' || !('done' in item)) return item;
    const { done: _tick, ...rest } = item as Record<string, unknown>;
    return rest;
  });
}

// JSON with every object's keys sorted at every depth and undefined members left out, so equal content prints (and
// hashes) equally whatever order it was written in. Shared with the CLI's pull and mirror files.
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) {
    return `[${value.map((item) => (item === undefined ? 'null' : canonicalJson(item))).join(',')}]`;
  }
  const record = value as Record<string, unknown>;
  const parts: string[] = [];
  for (const key of Object.keys(record).sort()) {
    const item = record[key];
    if (item === undefined || typeof item === 'function') continue;
    parts.push(`${JSON.stringify(key)}:${canonicalJson(item)}`);
  }
  return `{${parts.join(',')}}`;
}

function fnv1a(bytes: Uint8Array, offsetBasis: number): number {
  let hash = offsetBasis;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function hex32(value: number): string {
  return value.toString(16).padStart(8, '0');
}
