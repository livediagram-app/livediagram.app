// The icon picker's Recent (docs/specs/030-knowledgebase/page-surface.md "The page icon"): this browser's last picks,
// newest first, as icon keys (pageIconKey), each tab showing its own kind. A per-viewer convenience: storage refused
// or wiped reads as no picks, and the picker shows no Recent.
import { pageIconKey, pageIconOfKey, type TabIcon } from '@liveknowledge/document';

export const PAGE_ICON_RECENT_KEY = 'liveknowledge:v2:page-icon-recent';
/** How many picks are kept. */
export const PAGE_ICON_RECENT_MAX = 16;

/** `recent` with `icon` put first, once; at most PAGE_ICON_RECENT_MAX. */
export function withRecentIcon(recent: readonly string[], icon: TabIcon): string[] {
  const key = pageIconKey(icon);
  if (!key) return [...recent];
  return [key, ...recent.filter((k) => k !== key)].slice(0, PAGE_ICON_RECENT_MAX);
}

/** The picks kept in this browser, newest first; none when storage is refused or holds something else. */
export function readRecentIcons(): TabIcon[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(PAGE_ICON_RECENT_KEY) ?? '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .slice(0, PAGE_ICON_RECENT_MAX)
      .map((k) => (typeof k === 'string' ? pageIconOfKey(k) : undefined))
      .filter((i): i is TabIcon => i !== undefined);
  } catch {
    return [];
  }
}

/** One more pick, kept in this browser (a refused write is dropped: Recent is a convenience). */
export function noteRecentIcon(icon: TabIcon): void {
  try {
    const keys = readRecentIcons()
      .map((i) => pageIconKey(i))
      .filter((k): k is string => k !== null);
    window.localStorage.setItem(PAGE_ICON_RECENT_KEY, JSON.stringify(withRecentIcon(keys, icon)));
  } catch {
    // Storage refused (a private window, blocked site data): no Recent.
  }
}
