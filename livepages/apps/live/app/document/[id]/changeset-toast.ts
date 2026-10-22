import { CHANGESET_TOAST_COALESCE_MS, type ChangesetRoomOp } from '@livediagram/api-schema';

// The toast one person's (or one agent's) burst of changesets raises
// (docs/specs/024-agents/blueprints/agent-changesets.md "The editor", "Presentation and UX"). Pure:
// the hook owns the clock and the toast stack.

export type ChangesetToast = {
  // The token's agentKey for an agent, else the changeset id: one toast per token at a time.
  key: string;
  changesetIds: string[];
  count: number;
  name: string;
  summary: string | null;
  lastAt: number;
  tabId: string;
  touched: string[];
};

export function coalesceChangesetToast(
  toasts: ReadonlyMap<string, ChangesetToast>,
  op: ChangesetRoomOp,
  now: number,
): ChangesetToast {
  const key = op.agentKey ?? op.id;
  const count = op.counts.added + op.counts.changed + op.counts.removed;
  const summary = op.summary ?? null;
  const touched = touchedIdsOf(op);
  const open = toasts.get(key);
  if (open && now - open.lastAt <= CHANGESET_TOAST_COALESCE_MS) {
    return {
      ...open,
      changesetIds: [...open.changesetIds, op.id],
      count: open.count + count,
      summary,
      lastAt: now,
      tabId: op.tabId,
      touched: [...new Set([...open.touched, ...touched])],
    };
  }
  return {
    key,
    changesetIds: [op.id],
    count,
    name: op.author.name,
    summary,
    lastAt: now,
    tabId: op.tabId,
    touched,
  };
}

// "Webber changed 3 elements: add payment service". Adds and removals count as changed.
export function changesetToastCopy(toast: ChangesetToast): string {
  const elements = `${toast.count} element${toast.count === 1 ? '' : 's'}`;
  return `${toast.name} changed ${elements}${toast.summary ? `: ${toast.summary}` : ''}`;
}

export function undoneCopy(kept: number): string {
  if (kept === 0) return 'Undone';
  return `Undone, ${kept} kept because ${kept === 1 ? 'it' : 'they'} changed since`;
}

// Every element a changeset touched: its element ops' ids, or the list an oversize relay carries.
export function touchedIdsOf(op: ChangesetRoomOp): string[] {
  if (!op.elementOps) return op.touched ?? [];
  const ids = new Set<string>();
  for (const elOp of op.elementOps) {
    if (elOp.kind === 'remove') ids.add(elOp.id);
    else if (elOp.kind !== 'reorder') ids.add(elOp.element.id);
  }
  return [...ids];
}
