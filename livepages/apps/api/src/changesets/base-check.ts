import { elementFingerprint, type Element, type Tab } from '@livediagram/document';
import type { ChangesetBase, ChangesetConflict } from '@livediagram/api-schema';

// The base check (docs/specs/024-agents/agent-changesets.md "Conflicts"): what the agent read
// against the tab as stored now. Pure. Only targets are checked: elements an operation merely
// shifts to make room are never fingerprinted, since a shift commutes with a person's move.

export type BaseOutcome =
  | { ok: true; rebasedOver: number; warnings: 'no_base'[] }
  | { ok: false; status: 400; error: 'strict_needs_base' | 'invalid_base' }
  | { ok: false; status: 412; error: 'stale_tab'; rev: number }
  | {
      ok: false;
      status: 409;
      error: 'changeset_conflict';
      rev: number;
      conflicts: ChangesetConflict[];
    };

// `targetIds` are the existing elements the operations resolved; `createdIds` the elements the
// changeset makes, which the base cannot have read. A null `stored` is a tab the changeset creates.
export function checkBase(
  base: ChangesetBase | undefined,
  stored: (Tab & { rev: number }) | null,
  targetIds: readonly string[],
  createdIds: readonly string[],
  strict: boolean,
): BaseOutcome {
  const storedRev = stored?.rev ?? 0;
  if (!base) {
    if (strict) return { ok: false, status: 400, error: 'strict_needs_base' };
    return { ok: true, rebasedOver: 0, warnings: ['no_base'] };
  }
  if (base.rev > storedRev) return { ok: false, status: 400, error: 'invalid_base' };
  if (base.rev === storedRev) return { ok: true, rebasedOver: 0, warnings: [] };
  if (strict) return { ok: false, status: 412, error: 'stale_tab', rev: storedRev };

  const now = new Map<string, Element>((stored?.elements ?? []).map((e) => [e.id, e]));
  const read = base.elements ?? {};
  const conflicts: ChangesetConflict[] = [];
  for (const [id, readFingerprint] of Object.entries(read)) {
    const current = now.get(id);
    if (!current) conflicts.push({ id, reason: 'vanished', readFingerprint, now: null });
    else if (elementFingerprint(current) !== readFingerprint) {
      conflicts.push({ id, reason: 'changed', readFingerprint, now: current });
    }
  }
  const created = new Set(createdIds);
  for (const id of new Set(targetIds)) {
    if (created.has(id) || Object.hasOwn(read, id)) continue;
    conflicts.push({
      id,
      reason: 'resolves_differently',
      readFingerprint: null,
      now: now.get(id) ?? null,
    });
  }
  if (conflicts.length > 0) {
    return { ok: false, status: 409, error: 'changeset_conflict', rev: storedRev, conflicts };
  }
  return { ok: true, rebasedOver: storedRev - base.rev, warnings: [] };
}
