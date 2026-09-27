import type { UserPreferences } from './user-preferences';

// Power user mode (docs/specs/007-editor/power-user-mode.md): a preset of recommended settings,
// written once when the mode switches on. Switching off puts back the values
// the preset replaced, for every setting still holding what the preset wrote.
//
// A setting may span several keys: the panel layout keeps its legacy
// `minimalPanels` mirror in step, so the two are compared and restored as one.
export const POWER_USER_PRESET = {
  panelLayout: { panelLayout: 'toolbar', minimalPanels: false },
  alignmentGuides: { alignmentGuides: true },
  autoRebindArrows: { autoRebindArrows: true },
  tourSeen: { tourSeen: true },
  aiSuggestedPrompts: { aiSuggestedPrompts: false },
  minimalChrome: { minimalChrome: true },
} as const satisfies Record<string, Partial<UserPreferences>>;

export type PowerUserPresetSetting = keyof typeof POWER_USER_PRESET;

export type PowerUserBaselineEntry = {
  before: Partial<UserPreferences>;
  applied: Partial<UserPreferences>;
};

type Switched = { prefs: UserPreferences; restored: string[]; kept: string[] };

type Bag = Record<string, unknown>;

export function isPowerUserMode(prefs: UserPreferences): boolean {
  return prefs.powerUserMode === true;
}

// The flag every chrome surface reads: Minimal chrome is a power-user-only
// setting, so it counts only while the mode is on, where missing means on.
export function isMinimalChrome(prefs: UserPreferences): boolean {
  return isPowerUserMode(prefs) && prefs.minimalChrome !== false;
}

export function setPowerUserMode(prefs: UserPreferences, on: boolean): Switched {
  if (on === isPowerUserMode(prefs)) return { prefs, restored: [], kept: [] };
  return on ? switchOn(prefs) : switchOff(prefs);
}

function switchOn(prefs: UserPreferences): Switched {
  const current = prefs as Bag;
  const next: Bag = { ...current };
  const baseline: Record<string, PowerUserBaselineEntry> = {};
  for (const [setting, applied] of Object.entries(POWER_USER_PRESET)) {
    // Only keys actually present, so an absent key stays absent through the
    // JSON round trip and restoring it deletes it.
    const before: Bag = {};
    for (const key of Object.keys(applied)) {
      if (key in current) before[key] = current[key];
    }
    baseline[setting] = { before, applied: { ...applied } };
    Object.assign(next, applied);
  }
  next.powerUserMode = true;
  next.powerUserBaseline = baseline;
  console.info('[power-user] on', { applied: Object.keys(POWER_USER_PRESET) });
  return { prefs: next as UserPreferences, restored: [], kept: [] };
}

function switchOff(prefs: UserPreferences): Switched {
  const next: Bag = { ...(prefs as Bag) };
  const restored: string[] = [];
  const kept: string[] = [];
  for (const [setting, entry] of Object.entries(prefs.powerUserBaseline ?? {})) {
    const applied = entry.applied as Bag;
    const before = entry.before as Bag;
    const untouched = Object.keys(applied).every((key) => Object.is(next[key], applied[key]));
    if (!untouched) {
      kept.push(setting);
      continue;
    }
    for (const key of Object.keys(applied)) {
      if (key in before) next[key] = before[key];
      else delete next[key];
    }
    restored.push(setting);
  }
  delete next.powerUserMode;
  delete next.powerUserBaseline;
  console.info('[power-user] off', { restored, kept });
  return { prefs: next as UserPreferences, restored, kept };
}
