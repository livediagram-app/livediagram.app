import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES } from '@/lib/help-articles';
import { SETTINGS_CATEGORIES, settingsCategoryPath, visibleCategories } from './settings-catalogue';
import { TELEMETRY_TYPE_PATTERN } from '@livediagram/api-schema';
import type { SettingsRowSpec } from './settings-catalogue';
import { autoRebindArrowsEnabled, type UserPreferences } from '@/lib/user-preferences';

const ALL_ROWS = SETTINGS_CATEGORIES.flatMap((c) => c.rows);
const TOGGLES = ALL_ROWS.filter((r) => r.kind === 'toggle');
const CHOICES = ALL_ROWS.filter((r) => r.kind === 'choice');
const SLIDERS = ALL_ROWS.filter((r) => r.kind === 'slider');
const BOTH_CONTEXTS = [
  { emailEnabled: true, signedIn: true },
  { emailEnabled: true, signedIn: false },
  { emailEnabled: false, signedIn: true },
  { emailEnabled: false, signedIn: false },
];

// Every row that reads and writes a preference, whatever its control.
const PREF_BACKED = [...TOGGLES, ...CHOICES, ...SLIDERS];

function tokensOf(row: SettingsRowSpec): string[] {
  if (row.kind === 'toggle') return [row.event.on, row.event.off];
  if (row.kind === 'choice' || row.kind === 'slider') return [row.event.changed];
  return [];
}

describe('settings catalogue', () => {
  it('shows Auto-Attach Arrows in the state the editor actually runs', () => {
    // A fresh profile has the feature OFF; the switch has to say so, or the
    // first click flips a switch that looked on to the off it already was.
    const row = TOGGLES.find((r) => r.key === 'autoRebindArrows')!;
    for (const prefs of [{}, { autoRebindArrows: true }, { autoRebindArrows: false }]) {
      expect(row.read(prefs as UserPreferences)).toBe(autoRebindArrowsEnabled(prefs));
    }
  });

  it('round-trips every toggle through read/write in both directions', () => {
    // The catalogue is the only place that knows how a setting maps onto
    // UserPreferences, so a row whose write does not land where its read
    // looks would silently be a switch that never moves.
    for (const row of TOGGLES) {
      for (const target of [true, false]) {
        const next = row.write({} as UserPreferences, target);
        expect(row.read(next), `${row.key} -> ${target}`).toBe(target);
      }
    }
  });

  it('round-trips every choice and slider too', () => {
    for (const row of CHOICES) {
      for (const option of row.options) {
        expect(row.read(row.write({} as UserPreferences, option.id)), row.key).toBe(option.id);
      }
    }
    for (const row of SLIDERS) {
      for (const value of [row.min, row.max]) {
        expect(row.read(row.write({} as UserPreferences, value)), row.key).toBe(value);
      }
    }
  });

  it('inverts the welcome-tour row against the stored preference', () => {
    // The row asks "show me the tour?"; `tourSeen` records "already seen".
    // Getting this backwards would re-offer the tour to everyone who has
    // taken it, so it is worth pinning both directions explicitly.
    const row = TOGGLES.find((r) => r.key === 'tourSeen')!;
    expect(row.read({ tourSeen: true })).toBe(false);
    expect(row.read({ tourSeen: false })).toBe(true);
    expect(row.read({})).toBe(true);
    expect(row.write({}, true).tourSeen).toBe(false);
    expect(row.write({}, false).tourSeen).toBe(true);
    // And the tokens still describe the PREFERENCE, so the dashboard series
    // keeps its meaning: switching the row on means "not seen".
    expect(row.event.on).toBe('TourSeenOff');
    expect(row.event.off).toBe('TourSeenOn');
  });

  it('defaults every slider and choice to a value it actually offers', () => {
    for (const row of CHOICES) {
      const fallback = row.read({} as UserPreferences);
      expect(
        row.options.map((o) => o.id),
        row.key,
      ).toContain(fallback);
    }
    for (const row of SLIDERS) {
      const fallback = row.read({} as UserPreferences);
      expect(fallback, row.key).toBeGreaterThanOrEqual(row.min);
      expect(fallback, row.key).toBeLessThanOrEqual(row.max);
    }
  });

  it('writes only its own key, so one switch never moves another', () => {
    const before: UserPreferences = { minimalPanels: true, telemetryEnabled: false };
    // Power user mode is a PRESET by design (docs/specs/007-editor/power-user-mode.md): it moves
    // exactly the preset's settings, pinned by its own test below.
    for (const row of TOGGLES.filter((r) => r.key !== 'powerUserMode')) {
      const after = row.write(before, !row.read(before));
      const changed = Object.keys({ ...before, ...after }).filter(
        (k) => before[k as keyof UserPreferences] !== after[k as keyof UserPreferences],
      );
      expect(changed, row.key).toHaveLength(1);
    }
  });

  it('keeps row keys and telemetry tokens unique', () => {
    const keys = ALL_ROWS.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    const tokens = PREF_BACKED.flatMap(tokensOf);
    expect(new Set(tokens).size).toBe(tokens.length);
  });

  it('emits telemetry tokens the public dashboard will accept', () => {
    // docs/specs/017-telemetry/telemetry.md bounds the `type` slot so the dashboard can never render
    // user-generated content. A token that fails the pattern is dropped on
    // the floor, which is invisible until the chart is missing a series.
    for (const token of ALL_ROWS.flatMap(tokensOf)) {
      expect(TELEMETRY_TYPE_PATTERN.test(token), token).toBe(true);
    }
  });

  it('points every help link at a registered article', () => {
    for (const row of ALL_ROWS) {
      if (!row.helpArticle) continue;
      expect(HELP_ARTICLES, row.key).toHaveProperty(row.helpArticle);
    }
  });

  it('titles every row in Title Case', () => {
    // House style (the same rule the help centre's labels follow): every
    // word capitalised except the short joining words, which never lead.
    const MINOR = new Set(['a', 'an', 'and', 'the', 'on', 'of', 'in', 'to', 'or', 'my', 'me']);
    for (const row of ALL_ROWS) {
      const words = row.label.replace(/^Email:\s*/, '').split(' ');
      words.forEach((word, i) => {
        const bare = word.replace(/[^A-Za-z-]/g, '');
        if (!bare) return;
        if (i > 0 && MINOR.has(bare.toLowerCase())) return;
        expect(bare[0], `${row.label} -> "${word}"`).toBe(bare[0]!.toUpperCase());
      });
    }
  });

  it('hides the AI category until the worker advertises the capability', () => {
    const ctx = { emailEnabled: true, signedIn: true };
    expect(visibleCategories(false, ctx).map((c) => c.id)).not.toContain('ai');
    expect(visibleCategories(true, ctx).map((c) => c.id)).toContain('ai');
  });

  it('drops the email rows unless mail can be sent AND someone is signed in', () => {
    const withEmail = visibleCategories(true, { emailEnabled: true, signedIn: true });
    const without = visibleCategories(true, { emailEnabled: false, signedIn: true });
    const guest = visibleCategories(true, { emailEnabled: true, signedIn: false });
    const guestRows = guest.find((c) => c.id === 'notifications')!.rows;
    expect(guestRows.map((r) => r.key)).not.toContain('notifyComments');
    // ...but the section still says the settings exist, the same way the API
    // tokens row does, rather than vanishing without explanation.
    expect(guestRows.map((r) => r.key)).toContain('emailSignIn');
    expect(withEmailRows()).not.toContain('emailSignIn');
    function withEmailRows() {
      return visibleCategories(true, { emailEnabled: true, signedIn: true })
        .find((c) => c.id === 'notifications')!
        .rows.map((r) => r.key);
    }
    const notifyRows = (cats: typeof withEmail) =>
      cats.find((c) => c.id === 'notifications')!.rows.map((r) => r.key);
    expect(notifyRows(withEmail)).toContain('notifyComments');
    expect(notifyRows(without)).not.toContain('notifyComments');
    // The category survives either way: in-editor notifications are not
    // gated on email, so Notifications never becomes a dead end.
    expect(notifyRows(without)).toContain('notificationsEnabled');
  });

  it('offers Minimal chrome only while power user mode is on', () => {
    const editorRows = (powerUserMode: boolean) =>
      visibleCategories(true, { emailEnabled: false, signedIn: false, powerUserMode })
        .find((c) => c.id === 'editor')!
        .rows.map((r) => r.key);
    expect(editorRows(false)).toContain('powerUserMode');
    expect(editorRows(false)).not.toContain('minimalChrome');
    expect(editorRows(true)).toEqual(expect.arrayContaining(['powerUserMode', 'minimalChrome']));
  });

  it('switches power user mode through the preset, not a bare flag', () => {
    const row = TOGGLES.find((r) => r.key === 'powerUserMode')!;
    const on = row.write({ panelLayout: 'floating' } as UserPreferences, true);
    expect(on.panelLayout).toBe('toolbar');
    expect(on.minimalChrome).toBe(true);
    expect(row.read(on)).toBe(true);
    const off = row.write(on, false);
    expect(off).toEqual({ panelLayout: 'floating' });
    expect(row.event).toEqual({ category: 'UI', on: 'PowerUserModeOn', off: 'PowerUserModeOff' });
  });

  it('names the Minimal chrome flips in telemetry', () => {
    const row = TOGGLES.find((r) => r.key === 'minimalChrome')!;
    expect(row.event).toEqual({ category: 'UI', on: 'MinimalChromeOn', off: 'MinimalChromeOff' });
  });

  it('never offers a category with no rows', () => {
    // An empty category is a dead end: a row that pushes a blank pane.
    for (const ctx of BOTH_CONTEXTS) {
      for (const aiCapable of [true, false]) {
        for (const category of visibleCategories(aiCapable, ctx)) {
          expect(category.rows.length, category.id).toBeGreaterThan(0);
        }
      }
    }
  });
});

// Panels holds sub-categories (docs/specs/007-editor/user-preferences.md), each its own pane.
describe('settings sub-categories', () => {
  it('nests one sub-category per panel under Panels, directly after it and in order', () => {
    const ids = SETTINGS_CATEGORIES.map((c) => c.id);
    const children = SETTINGS_CATEGORIES.filter((c) => c.parent === 'panels').map((c) => c.id);
    expect(children).toEqual(['layers', 'activity', 'map', 'collaborate', 'quickStyle']);
    const at = ids.indexOf('panels');
    expect(ids.slice(at + 1, at + 1 + children.length)).toEqual(children);
  });

  it('keeps Panel Layout and Panel Opacity on Panels itself, and Enable Map under Map', () => {
    const keys = (id: string) =>
      SETTINGS_CATEGORIES.find((c) => c.id === id)!.rows.map((r) => r.key);
    expect(keys('panels')).toEqual(['panelLayout', 'panelOpacity']);
    expect(keys('map')[0]).toBe('showMinimap');
  });

  it('opens every panel sub-category with its Enable switch, on by default', () => {
    const first = (id: string) => SETTINGS_CATEGORIES.find((c) => c.id === id)!.rows[0]!;
    const switches: Record<string, [string, string]> = {
      layers: ['layersPanelEnabled', 'Enable Layers Panel'],
      activity: ['activityPanelEnabled', 'Enable Activity Panel'],
      map: ['showMinimap', 'Enable Map'],
      collaborate: ['collaboratePanelEnabled', 'Enable Collaborate Panel'],
      quickStyle: ['quickStylePanelEnabled', 'Enable Quick Style Panel'],
    };
    for (const [id, [key, label]] of Object.entries(switches)) {
      const row = first(id);
      expect([row.key, row.label]).toEqual([key, label]);
      if (row.kind !== 'toggle') throw new Error(`${key} is not a toggle`);
      expect(row.read({})).toBe(true);
      expect(row.write({}, false)).toEqual({ [key]: false });
    }
  });

  it("offers a panel's other rows only while its Enable switch is on", () => {
    const rows = (id: string, preferences: UserPreferences) =>
      visibleCategories(false, { emailEnabled: false, signedIn: false, preferences })
        .find((c) => c.id === id)!
        .rows.map((r) => r.key);
    expect(rows('layers', {})).toEqual([
      'layersPanelEnabled',
      'layersShowPreview',
      'layersShowCount',
      'layerHoverPreview',
    ]);
    expect(rows('layers', { layersPanelEnabled: false })).toEqual(['layersPanelEnabled']);
    expect(rows('activity', { activityPanelEnabled: false })).toEqual(['activityPanelEnabled']);
    expect(rows('map', { showMinimap: false })).toEqual(['showMinimap']);
    expect(rows('map', {})).toEqual(['showMinimap', 'mapDimOutside', 'mapSize']);
  });

  it('names a sub-category by its path', () => {
    const map = SETTINGS_CATEGORIES.find((c) => c.id === 'map')!;
    expect(settingsCategoryPath(map)).toBe('Panels › Map');
    expect(settingsCategoryPath(SETTINGS_CATEGORIES.find((c) => c.id === 'panels')!)).toBe(
      'Panels',
    );
  });
});
