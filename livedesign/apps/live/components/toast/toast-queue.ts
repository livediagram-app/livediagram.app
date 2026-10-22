// The toast queue's writes (docs/specs/004-interface-design/toasts.md "Timing"), pure so the provider
// stays a thin shell around them: dedupe, upsert in place by key, and the four-toast limit.

export type ToastTone = 'info' | 'success' | 'warning' | 'error';

// An offer (docs/specs/007-editor/power-user-mode.md): a toast that asks something, so it carries two
// answers. It stays up longer than a plain toast (TOAST_ANSWER_TIMEOUT_MS), then leaves unanswered. Closing it is
// the decline; timing out is neither answer.
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
export type ToastActionSpec = {
  key: string;
  message: string;
  actions: ToastAction[];
  // Shown even with In-Editor Notifications off: it explains why something the person did had no effect.
  important?: boolean;
};

export type ToastEntry = {
  id: number;
  message: string;
  tone: ToastTone;
  offer?: ToastOffer;
  key?: string;
  actions?: ToastAction[];
  // Dismissed, still playing its exit before the stack removes it.
  leaving?: boolean;
  // Arrived on a full stack and retired an older toast: it enters with a bolder pop, so the change is seen.
  full?: boolean;
};

/** How long a toast that times out stays up, by tone (the spec's "Tones" table). */
export const TOAST_TIMEOUT_MS: Readonly<Record<ToastTone, number>> = {
  info: 4_000,
  success: 4_000,
  warning: 6_000,
  error: 6_000,
};

/**
 * How long a toast with answers (an offer, or an action toast with a button) stays up: long enough to reach for its
 * button, never for good. Hovering, focusing or hiding the page pauses it, like every toast.
 */
export const TOAST_ANSWER_TIMEOUT_MS = 10_000;

/** The most toasts up at once; a newer one retires the oldest without answers. Three keeps a burst (a run of
 *  deletes) from covering the screen. */
export const TOAST_LIMIT = 3;

/** Whether a toast carries answers (an offer, or an action toast with a button), so it stays up longer. */
export function toastAnswers(entry: Pick<ToastEntry, 'offer' | 'actions'>): boolean {
  return entry.offer !== undefined || (entry.actions?.length ?? 0) > 0;
}

/** How long a toast stays up: its tone's time, or the longer answer time for one with buttons. */
export function toastTimeout(entry: Pick<ToastEntry, 'offer' | 'actions' | 'tone'>): number {
  return toastAnswers(entry) ? TOAST_ANSWER_TIMEOUT_MS : TOAST_TIMEOUT_MS[entry.tone];
}

// Append a toast, retiring past the limit; one that retired another arrived on a full stack and is marked `full`.
function appendToast(list: ToastEntry[], entry: ToastEntry): ToastEntry[] {
  const next = applyLimit([...list, entry]);
  const retired = next.filter((t) => t.leaving).length > list.filter((t) => t.leaving).length;
  return retired ? next.map((t) => (t.id === entry.id ? { ...t, full: true } : t)) : next;
}

// Retire (mark leaving) the oldest toast past the limit: the oldest without answers first, else the oldest of all.
function applyLimit(list: ToastEntry[]): ToastEntry[] {
  let next = list;
  for (;;) {
    const live = next.filter((t) => !t.leaving);
    if (live.length <= TOAST_LIMIT) return next;
    const victim = live.find((t) => !toastAnswers(t)) ?? live[0]!;
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
  return appendToast(list, { id, ...input });
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
  if (at === -1) return appendToast(list, { id, ...entry });
  const next = list.slice();
  next[at] = { ...list[at]!, ...entry };
  return next;
}

/** Mark the matching toasts leaving (their exit plays, then they are removed). */
export function retireToasts(list: ToastEntry[], match: (t: ToastEntry) => boolean): ToastEntry[] {
  if (!list.some((t) => !t.leaving && match(t))) return list;
  return list.map((t) => (!t.leaving && match(t) ? { ...t, leaving: true } : t));
}
