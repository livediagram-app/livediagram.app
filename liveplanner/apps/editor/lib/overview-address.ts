// Where a plan opens, and the Overview's address (docs/specs/026-plan/plan-overview.md "A plan opens on its
// Overview", "Its address"). Pure, so every way in is tested without an editor.

// The address while the Overview is open, in the tab pin's place.
export const OVERVIEW_HASH = '#overview';

// The mark /new leaves on the entry it hands a just-made plan off on: that plan opens on its tab (Start Planning).
export const NEW_PLAN_KEY = 'liveplannerNewPlan';

export function newPlanEntryState(): Record<string, boolean> {
  return { [NEW_PLAN_KEY]: true };
}

export function isNewPlanEntry(state: unknown): boolean {
  return (
    typeof state === 'object' &&
    state !== null &&
    (state as Record<string, unknown>)[NEW_PLAN_KEY] === true
  );
}

// The tab a fragment pins (`#t=<id>`, with or without a card or an element beside it), or null.
export function hashTabId(hash: string): string | null {
  const match = hash.match(/(?:^#?|&)t=([^&]+)/);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1]!);
  } catch {
    return match[1]!;
  }
}

export function isOverviewHash(hash: string): boolean {
  return hash === OVERVIEW_HASH;
}

// Where an opened plan lands: the tab the address names when it is a real one the session may open, else the first
// tab, with the Overview open in front of it unless the session has none (an embed, a tab-scoped link) or the plan
// was just made (its first tab is Start Planning).
export function landingOf(input: {
  hash: string;
  tabIds: readonly string[];
  firstId: string | null;
  newPlan: boolean;
  overviewAllowed: boolean;
  inScope: (tabId: string) => boolean;
}): { tabId: string | null; overview: boolean } {
  const named = hashTabId(input.hash);
  if (named && input.tabIds.includes(named) && input.inScope(named)) {
    return { tabId: named, overview: false };
  }
  return { tabId: input.firstId, overview: input.overviewAllowed && !input.newPlan };
}

// The fragment the editor keeps while no card is shown: the Overview's, or the open tab's pin.
export function pinHash(activeId: string, overviewOpen: boolean): string {
  return overviewOpen ? OVERVIEW_HASH : `#t=${activeId}`;
}
