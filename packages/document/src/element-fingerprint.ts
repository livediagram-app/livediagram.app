import { LIVE_ELEMENT_FIELDS } from './comments';
import type { Element } from './index';

// An element's fingerprint (docs/specs/024-agents/agent-changesets.md "What a changeset is"): what
// an agent says it read, what a changeset found and left, compared to tell whether anybody changed
// the element since. The api, the MCP and the CLI call this one function, so a fingerprint taken
// on one side matches one taken on the other.
//
// It covers the element without its live multi-writer fields (LIVE_ELEMENT_FIELDS: comments,
// answers, ideas and the like) and without checklist ticks: people change those through deltas
// that never conflict with an agent's edit.

export const ELEMENT_FINGERPRINT_LENGTH = 16;

const LIVE_FIELDS: ReadonlySet<string> = new Set(LIVE_ELEMENT_FIELDS);

// The JSON of the element without its live fields: object keys sorted at every depth, array
// order kept, `undefined` dropped (as JSON.stringify drops it).
export function canonicalElementJson(element: Element): string {
  const record = element as unknown as Record<string, unknown>;
  const authored: Record<string, unknown> = {};
  for (const key of Object.keys(record)) {
    if (LIVE_FIELDS.has(key)) continue;
    authored[key] = key === 'checklistItems' ? withoutTicks(record[key]) : record[key];
  }
  return canonicalJson(authored);
}

// 16 lowercase hex characters: two 32-bit FNV-1a lanes with different offset bases over the
// canonical JSON's UTF-8 bytes (CS6). Synchronous, so every caller can use it inline.
export function elementFingerprint(element: Element): string {
  const bytes = new TextEncoder().encode(canonicalElementJson(element));
  return hex32(fnv1a(bytes, 0x811c9dc5)) + hex32(fnv1a(bytes, 0x050c5d1f));
}

function withoutTicks(items: unknown): unknown {
  if (!Array.isArray(items)) return items;
  return items.map((item) => {
    if (!item || typeof item !== 'object' || !('done' in item)) return item;
    const { done: _tick, ...rest } = item as Record<string, unknown>;
    return rest;
  });
}

function canonicalJson(value: unknown): string {
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
