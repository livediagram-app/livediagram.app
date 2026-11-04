// The calls kill switch (docs/specs/016-platform/calls-kill-switch.md): one KV key, `calls-mode`, says whether calls
// may use Cloudflare Realtime at all (`on`), for audio alone (`audio-only`), or not at all (`off`). A person flips it
// with one `wrangler kv key put`, the budget poll (calls-budget.ts) trips it, and the Realtime mint route reads it
// through callsMode() before every session and track. Text, avatars and the Space never depend on it.

/** The KV binding the switch lives in; the slice of Env this module needs. */
export type CallsSwitchEnv = {
  CALLS_SWITCH?: KVNamespace;
};

import type { CallsMode } from '@livehuddle/api-schema';

// The modes and what each allows are shared with the editor (@livehuddle/api-schema's calls-mode.ts).
export {
  callsModeAllows,
  callTrackKind,
  type CallsMediaKind,
  type CallsMode,
} from '@livehuddle/api-schema';

export const CALLS_MODE_KEY = 'calls-mode';

/** How long one isolate trusts its last read: a burst of joins costs one KV read, and a flip lands within it. */
export const CALLS_MODE_CACHE_MS = 5_000;

// Strictness order: a higher rank allows less.
const RANK: Record<CallsMode, number> = { on: 0, 'audio-only': 1, off: 2 };

/**
 * A raw KV value to a mode. No key reads as `on` (the switch is a brake, never a prerequisite); a value it does not
 * know reads as `off`, so a typo stops spending rather than starting it.
 */
export function parseCallsMode(raw: string | null | undefined): CallsMode {
  if (raw === null || raw === undefined) return 'on';
  const value = raw.trim().toLowerCase();
  if (value === '' || value === 'on') return 'on';
  if (value === 'audio-only' || value === 'audio_only' || value === 'audio') return 'audio-only';
  return 'off';
}

/** The mode that allows less of the two. */
export function stricterCallsMode(a: CallsMode, b: CallsMode): CallsMode {
  return RANK[a] >= RANK[b] ? a : b;
}

let cached: { mode: CallsMode; at: number } | null = null;

/**
 * The switch's mode, read from KV at most once per CALLS_MODE_CACHE_MS per isolate. Never throws: with no binding
 * it is `on`; when KV cannot be read, the last answer this isolate had stands, else `on`.
 */
export async function callsMode(env: CallsSwitchEnv, now: number = Date.now()): Promise<CallsMode> {
  if (cached && now - cached.at < CALLS_MODE_CACHE_MS) return cached.mode;
  const kv = env.CALLS_SWITCH;
  if (!kv) return 'on';
  try {
    const mode = parseCallsMode(await kv.get(CALLS_MODE_KEY));
    cached = { mode, at: now };
    return mode;
  } catch (err) {
    console.error('[calls] could not read the calls switch', err);
    return cached?.mode ?? 'on';
  }
}

/** Write the switch, and make this isolate see it at once (the poll's own later reads, and tests). */
export async function writeCallsMode(
  kv: KVNamespace,
  mode: CallsMode,
  now: number = Date.now(),
): Promise<void> {
  await kv.put(CALLS_MODE_KEY, mode);
  cached = { mode, at: now };
}

/** Forget the cached read (tests). */
export function resetCallsModeCache(): void {
  cached = null;
}
