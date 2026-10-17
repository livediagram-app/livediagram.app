// The toast queue's writes (docs/specs/004-interface-design/toasts.md "Timing"), pure so the provider
// stays a thin shell around them: dedupe, upsert in place by key, and the four-toast limit.

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

// An offer (docs/specs/007-editor/power-user-mode.md): a toast that asks something, so it carries two
// answers and waits for one: no timeout (WCAG 2.2.1). Closing it is the decline.
export type ToastOffer = {
  message: string;
  confirmLabel: string;
  declineLabel: string;
  onConfirm: () => void;
  onDecline: () => void;
};

// An action toast (docs/specs/024-agents/agent-changesets.md "In the editor"): buttons that act on what
// the message names. Upserted in place by `key`, so a burst updates one toast.
export type ToastAction = {
  label: string;
  ariaLabel?: string;
  onSelect: () => void;
  disabled?: boolean;
};
export type ToastActionSpec = { key: string; message: string; actions: ToastAction[] };

export type ToastEntry = {
  id: number;
  message: string;
  tone: ToastTone;
  offer?: ToastOffer;
  key?: string;
  actions?: ToastAction[];
  // Dismissed, still playing its exit before the stack removes it.
  leaving?: boolean;
};

/** How long a toast that times out stays up, by tone (the spec's "Tones" table). */
export const TOAST_TIMEOUT_MS: Readonly<Record<ToastTone, number>> = {
  info: 4_000,
  success: 4_000,
  warning: 6_000,
  error: 6_000,
};

/** The most toasts up at once; a newer one retires the oldest that times out. */
export const TOAST_LIMIT = 4;

/** Whether a toast waits for an answer (an offer, or an action toast with a button) rather than timing out. */
export function toastWaits(entry: Pick<ToastEntry, 'offer' | 'actions'>): boolean {
  return entry.offer !== undefined || (entry.actions?.length ?? 0) > 0;
}

/** The timeout of a toast, or null for one that waits. */
export function toastTimeout(entry: Pick<ToastEntry, 'offer' | 'actions' | 'tone'>): number | null {
  return toastWaits(entry) ? null : TOAST_TIMEOUT_MS[entry.tone];
}

// Retire (mark leaving) the oldest toast past the limit: the oldest that times out first, else the oldest of all.
function applyLimit(list: ToastEntry[]): ToastEntry[] {
  let next = list;
  for (;;) {
    const live = next.filter((t) => !t.leaving);
    if (live.length <= TOAST_LIMIT) return next;
    const victim = live.find((t) => !toastWaits(t)) ?? live[0]!;
    next = next.map((t) => (t.id === victim.id ? { ...t, leaving: true } : t));
  }
}

/** Add a plain toast or an offer; the same tone and message already up is not shown twice. */
export function pushToast(
  list: ToastEntry[],
  input: { message: string; tone: ToastTone; offer?: ToastOffer },
  id: number,
): ToastEntry[] {
  if (!input.message) return list;
  if (list.some((t) => !t.leaving && t.message === input.message && t.tone === input.tone)) {
    return list;
  }
  return applyLimit([...list, { id, ...input }]);
}

/** Add an action toast, or replace the one up under the same key in place (keeping its id and place). */
export function upsertActionToast(
  list: ToastEntry[],
  spec: ToastActionSpec,
  id: number,
): ToastEntry[] {
  if (!spec.message) return list;
  const entry = {
    message: spec.message,
    tone: 'info' as const,
    key: spec.key,
    actions: spec.actions,
  };
  const at = list.findIndex((t) => !t.leaving && t.key === spec.key);
  if (at === -1) return applyLimit([...list, { id, ...entry }]);
  const next = list.slice();
  next[at] = { ...list[at]!, ...entry };
  return next;
}

/** Mark the matching toasts leaving (their exit plays, then they are removed). */
export function retireToasts(list: ToastEntry[], match: (t: ToastEntry) => boolean): ToastEntry[] {
  if (!list.some((t) => !t.leaving && match(t))) return list;
  return list.map((t) => (!t.leaving && match(t) ? { ...t, leaving: true } : t));
}
