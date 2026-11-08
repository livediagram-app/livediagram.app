import type { ReplayMode } from '@/lib/replay/topic';

// Watch It Built's Settings rerun (docs/specs/007-editor/watch-it-built.md "Settings"): a mode's switch, or one of its
// topics', turned on from off and Settings closed opens that mode's start panel there and then when the open tab is in
// that mode. A window event keeps the dialog decoupled from WatchItBuiltHost.
export const WATCH_RELAUNCH_EVENT = 'livediagram:watch-relaunch';

export function requestWatchRelaunch(mode: ReplayMode): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ReplayMode>(WATCH_RELAUNCH_EVENT, { detail: mode }));
}
