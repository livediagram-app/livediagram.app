// Apply to All Tabs (docs/specs/011-theme/canvas-and-theme-dialog.md "Apply to All Tabs" in each product): the active
// tab's style copied onto every other tab of the document as one change. Pure, so each editor's hook runs it inside
// one history-pushing commit and undo puts every tab back at once.

// The style a tab carries besides its theme (which each editor applies through its own theme switch, recolouring
// the tab's elements as picking that theme does): the canvas, the text defaults and the finish.
export const TAB_STYLE_KEYS = [
  'backgroundPattern',
  'backgroundColor',
  'patternColor',
  'backgroundOpacity',
  'backgroundPatternScale',
  'backgroundAnimationSpeed',
  'font',
  'defaultTextSize',
  'finish',
] as const;

export type TabStyleKey = (typeof TAB_STYLE_KEYS)[number];

/** `target` wearing `source`'s style settings: each key `source` sets is copied, each it leaves unset is cleared. */
export function withTabStyleOf<T extends object>(target: T, source: T): T {
  const next = { ...target } as Record<string, unknown>;
  const from = source as Record<string, unknown>;
  for (const key of TAB_STYLE_KEYS) {
    if (from[key] === undefined) delete next[key];
    else next[key] = from[key];
  }
  return next as T;
}

export type StyleAllOutcome = {
  // Tabs that took the style.
  styled: number;
  // Locked tabs, left as they are (a locked tab takes no change).
  locked: number;
  // Tabs whose content is not in this browser (a fetch that failed), left as they are so nothing is saved over them.
  unloaded: number;
};

/**
 * Every tab but `sourceId` restyled from it by `restyle`. A locked tab, and one `canWrite` refuses (content not
 * loaded), keeps its object, so the autosave never writes it. Returns the tabs and what happened to them; the same
 * array when nothing changed.
 */
export function styleAllTabs<T extends { id: string; locked?: boolean }>(
  tabs: readonly T[],
  sourceId: string,
  restyle: (tab: T, source: T) => T,
  canWrite: (tab: T) => boolean,
): { tabs: T[]; outcome: StyleAllOutcome } {
  const outcome: StyleAllOutcome = { styled: 0, locked: 0, unloaded: 0 };
  const source = tabs.find((t) => t.id === sourceId);
  if (!source) return { tabs: [...tabs], outcome };
  const next = tabs.map((tab) => {
    if (tab.id === sourceId) return tab;
    if (tab.locked) {
      outcome.locked += 1;
      return tab;
    }
    if (!canWrite(tab)) {
      outcome.unloaded += 1;
      return tab;
    }
    outcome.styled += 1;
    return restyle(tab, source);
  });
  return { tabs: next, outcome };
}

/** The toast after Apply to All Tabs: how many tabs took the style, and which kept their own. */
export function styleAllMessage({ styled, locked, unloaded }: StyleAllOutcome): string {
  const tabs = (n: number, kind = '') => `${n} ${kind}${n === 1 ? 'tab' : 'tabs'}`;
  const own = (n: number) => (n === 1 ? 'its own' : 'their own');
  const parts = [
    styled === 0
      ? 'No other tab took this style.'
      : `Applied this tab’s style to ${tabs(styled, 'other ')}.`,
  ];
  if (locked > 0) parts.push(`${tabs(locked, 'locked ')} kept ${own(locked)}.`);
  if (unloaded > 0) parts.push(`${tabs(unloaded)} couldn’t load and kept ${own(unloaded)}.`);
  return parts.join(' ');
}
