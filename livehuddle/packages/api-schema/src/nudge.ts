// Nudge (docs/specs/012-collaboration/nudge.md "The wire"): one person getting another's attention from the
// Collaborators list. `nudge` is a presence op ADDRESSED to its target alone, never fanned out; `nudge-refused` is the
// room's answer to a sender still cooling down, a system op no client may send. Neither is ordered, logged or
// replayed, and neither touches the document.
import { PRESENCE_ID_MAX } from './call-hand';

/** One nudge per this many ms from one person to another: the room refuses a second inside it. */
export const NUDGE_COOLDOWN_MS = 120_000;
/** Past this many entries the ledger drops those whose window is over. */
const LEDGER_PRUNE_AT = 256;

export type NudgeOp = { kind: 'nudge'; targetId: string };
export type NudgeRefusedOp = { kind: 'nudge-refused'; targetId: string; retryInMs: number };

/** A `nudge` op as sent, or null. */
export function parseNudge(op: unknown): NudgeOp | null {
  const o = op as { kind?: unknown; targetId?: unknown } | null;
  if (!o || o.kind !== 'nudge') return null;
  const { targetId } = o;
  if (typeof targetId !== 'string' || targetId.length === 0 || targetId.length > PRESENCE_ID_MAX)
    return null;
  return { kind: 'nudge', targetId };
}

/** A `nudge-refused` op as the room sends it, or null. */
export function parseNudgeRefused(op: unknown): NudgeRefusedOp | null {
  const o = op as { kind?: unknown; targetId?: unknown; retryInMs?: unknown } | null;
  if (!o || o.kind !== 'nudge-refused') return null;
  const { targetId, retryInMs } = o;
  if (typeof targetId !== 'string' || targetId.length === 0 || targetId.length > PRESENCE_ID_MAX)
    return null;
  if (typeof retryInMs !== 'number' || !Number.isFinite(retryInMs) || retryInMs < 0) return null;
  return { kind: 'nudge-refused', targetId, retryInMs: Math.min(retryInMs, NUDGE_COOLDOWN_MS) };
}

export type NudgeCheck = { ok: true } | { ok: false; retryInMs: number };

/**
 * Who nudged whom when, keyed `sender:target` by stable identity: `check` lets a nudge through (noting it) once per
 * window per pair and otherwise says how long is left. Memory only, at most one entry per pair nudged inside the
 * window once pruned; it prunes whenever it holds more than LEDGER_PRUNE_AT.
 */
export function createNudgeLedger(windowMs = NUDGE_COOLDOWN_MS) {
  const last = new Map<string, number>();
  const keyOf = (sender: string, target: string) => `${sender}\u0000${target}`;
  return {
    check(sender: string, target: string, now: number): NudgeCheck {
      const key = keyOf(sender, target);
      const at = last.get(key);
      if (at !== undefined && now - at < windowMs)
        return { ok: false, retryInMs: windowMs - (now - at) };
      last.set(key, now);
      if (last.size > LEDGER_PRUNE_AT)
        for (const [k, t] of last) if (now - t >= windowMs) last.delete(k);
      return { ok: true };
    },
    /** How long until `sender` may nudge `target` again; 0 when they may now. */
    remaining(sender: string, target: string, now: number): number {
      const at = last.get(keyOf(sender, target));
      return at === undefined ? 0 : Math.max(0, windowMs - (now - at));
    },
    /** Start the window as if a nudge passed `windowMs - retryInMs` ago (the room said how long is left). */
    hold(sender: string, target: string, now: number, retryInMs: number): void {
      last.set(keyOf(sender, target), now - (windowMs - Math.min(retryInMs, windowMs)));
    },
    size(): number {
      return last.size;
    },
  };
}

/** The time left as the countdown reads it, `m:ss`, rounded up to the second: "1:42", "0:05". */
export function nudgeCountdown(ms: number): string {
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
