import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES } from '@/lib/help-articles';
import { SETTINGS_CATEGORIES, settingsCategoryPath, visibleCategories } from './settings-catalogue';
import { TELEMETRY_TYPE_PATTERN, upgradeLegacyPreferences } from '@liveplanner/api-schema';
import type { SettingsRowSpec } from './settings-catalogue';
import type { UserPreferences } from '@/lib/user-preferences';

const ALL_ROWS = SETTINGS_CATEGORIES.flatMap((c) => c.rows);
const TOGGLES = ALL_ROWS.filter((r) => r.kind === 'toggle');
// The switches inside toggle groups (the tours): each its own preference, checked like a toggle row's.
const SWITCHES = TOGGLES;
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
  it('round-trips every toggle through read/write in both directions', () => {
    // The catalogue is the only place that knows how a setting maps onto
    // UserPreferences, so a row whose write does not land where its read
    // looks would silently be a switch that never moves.
    for (const row of TOGGLES) {
      for (const target of [true, false]) {
        const next = row.write({}, target);
        expect(row.read(next), `${row.key} -> ${target}`).toBe(target);
      }
    }
  });

  it('round-trips every choice and slider too', () => {
    for (const row of CHOICES) {
      for (const option of row.options) {
        expect(row.read(row.write({}, option.id)), row.key).toBe(option.id);
      }
    }
    for (const row of SLIDERS) {
      for (const value of [row.min, row.max]) {
        expect(row.read(row.write({}, value)), row.key).toBe(value);
      }
    }
  });

  it('gives each Plan tour track its own row, named for itself', () => {
    // docs/specs/026-plan/plan-tour.md "Where it appears": Boards Tour and Sheets Tour, never "Plan Tour".
    const boards = SWITCHES.find((r) => r.key === 'planTourSeen-boards')!;
    const sheets = SWITCHES.find((r) => r.key === 'planTourSeen-sheets')!;
    expect([boards.label, sheets.label]).toEqual(['Boards Tour', 'Sheets Tour']);
    expect(boards.read({ planTourTracks: ['boards'] })).toBe(false);
    expect(sheets.read({ planTourTracks: ['boards'] })).toBe(true);
    // On forgets this track alone; off answers it alone.
    expect(boards.write({ planTourTracks: ['boards', 'sheets'] }, true)).toEqual({
      planTourSeen: false,
      planTourTracks: ['sheets'],
    });
    expect(sheets.write({}, false)).toEqual({ planTourSeen: false, planTourTracks: ['sheets'] });
    expect(boards.event.on).toBe('BoardsTourSeenOff');
    expect(sheets.event.off).toBe('SheetsTourSeenOn');
  });

  it('keeps every track answered for someone who had Power user mode on, so one back on leaves the others', () => {
    // docs/specs/007-editor/power-user-mode.md "What happens to stored preferences": the blob as it is read.
    const power = upgradeLegacyPreferences({ powerUserMode: true, planTourSeen: true });
    const boards = SWITCHES.find((r) => r.key === 'planTourSeen-boards')!;
    const sheets = SWITCHES.find((r) => r.key === 'planTourSeen-sheets')!;
    expect(boards.read(power)).toBe(false);
    const next = boards.write(power, true);
    expect(boards.read(next)).toBe(true);
    expect(sheets.read(next)).toBe(false);
  });

  // docs/specs/007-editor/user-preferences.md "Getting Started": a category of its own, one switch per tour in
  // the order the tours come.
  it('gives the tours a category of their own, a switch each with its own article', () => {
    const tours = SETTINGS_CATEGORIES.find((c) => c.id === 'tours')!;
    expect(tours.rows.map((r) => [r.key, r.kind, r.label, r.helpArticle])).toEqual([
      // A tour of several tracks: one switch over them all, then each track's own row beneath it.
      ['planTourSeen', 'toggle', 'Plan Tours', 'planTour'],
      ['planTourSeen-boards', 'toggle', 'Boards Tour', 'planTour'],
      ['planTourSeen-sheets', 'toggle', 'Sheets Tour', 'planTour'],
      ['planTourSeen-dashboards', 'toggle', 'Dashboards Tour', 'planDashboards'],
      ['formTourSeen', 'toggle', 'Forms Tour', 'planForms'],
    ]);
    // One shared explanation under the section heading, not one per row.
    expect(tours.sectionNotes?.['Offer Again']?.note).toMatch(/close Settings/);
    const accessibility = SETTINGS_CATEGORIES.find((c) => c.id === 'accessibility')!;
    expect(accessibility.rows.some((r) => r.key.toLowerCase().includes('tour'))).toBe(false);
  });

  it('tracks each tour switch against its preference, as it always has', () => {
    const tours = SETTINGS_CATEGORIES.find((c) => c.id === 'tours')!;
    expect(tours.rows.map((r) => (r.kind === 'toggle' ? [r.event.on, r.event.off] : null))).toEqual(
      [
        ['PlanTourSeenOff', 'PlanTourSeenOn'],
        ['BoardsTourSeenOff', 'BoardsTourSeenOn'],
        ['SheetsTourSeenOff', 'SheetsTourSeenOn'],
        ['DashboardsTourSeenOff', 'DashboardsTourSeenOn'],
        ['FormTourSeenOff', 'FormTourSeenOn'],
      ],
    );
  });

  it('offers Button Labels in Appearance, on by default and desktop only', () => {
    const appearance = SETTINGS_CATEGORIES.find((c) => c.id === 'appearance')!;
    const row = appearance.rows.find((r) => r.key === 'dockButtonNames');
    if (row?.kind !== 'toggle') throw new Error('no Button Labels toggle');
    expect(row.label).toBe('Button Labels');
    expect(row.read({})).toBe(true);
    expect(row.read({ dockButtonNames: false })).toBe(false);
    expect(row.write({}, false)).toEqual({ dockButtonNames: false });
    expect(row.desktopOnly).toMatch(/Phones always show these buttons as icons/);
    expect(row.event).toMatchObject({ on: 'DockButtonNamesOn', off: 'DockButtonNamesOff' });
  });

  it('defaults every slider and choice to a value it actually offers', () => {
    for (const row of CHOICES) {
      const fallback = row.read({});
      expect(
        row.options.map((o) => o.id),
        row.key,
      ).toContain(fallback);
    }
    for (const row of SLIDERS) {
      const fallback = row.read({});
      expect(fallback, row.key).toBeGreaterThanOrEqual(row.min);
      expect(fallback, row.key).toBeLessThanOrEqual(row.max);
    }
  });

  it('writes only its own key, so one switch never moves another', () => {
    const before: UserPreferences = { homeBanner: false, telemetryEnabled: false };
    // A tour of several tracks also writes its answered list (lib/tour-tracks.ts).
    const own: Record<string, string[]> = {
      // A tour track's row writes the answered list and clears the tour's single flag (lib/tour-tracks.ts).
      planTourSeen: ['planTourSeen', 'planTourTracks'],
      'planTourSeen-boards': ['planTourSeen', 'planTourTracks'],
      'planTourSeen-sheets': ['planTourSeen', 'planTourTracks'],
      'planTourSeen-dashboards': ['planTourSeen', 'planTourTracks'],
    };
    for (const row of TOGGLES) {
      const after = row.write(before, !row.read(before));
      const changed = Object.keys({ ...before, ...after }).filter(
        (k) => before[k as keyof UserPreferences] !== after[k as keyof UserPreferences],
      );
      expect(changed, row.key).toEqual(own[row.key] ?? [row.key]);
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

  // Plan has no AI assistant and no diagram canvas: their categories are gone for good.
  it('offers no AI, Layers, Map or Quick Style category', () => {
    const ids = visibleCategories({ emailEnabled: true, signedIn: true }).map((c) => c.id);
    for (const gone of ['ai', 'layers', 'map', 'quickStyle']) expect(ids).not.toContain(gone);
  });

  // The editor in a workbench (docs/specs/013-workspace/blueprints/workbench-embeds.md, Surface table).
  it('leaves the account and tokens, and the Appearance choice, out of a workbench', () => {
    const ctx = { emailEnabled: true, signedIn: true, workbench: true };
    const categories = visibleCategories(ctx);
    const ids = categories.map((c) => c.id);

    for (const hidden of ['account', 'notifications', 'tokens']) {
      expect(ids).not.toContain(hidden);
    }
    expect(ids).toContain('tours');
    const appearance = categories.find((c) => c.id === 'appearance')!;
    expect(appearance.rows.some((r) => r.kind === 'appearance')).toBe(false);
    expect(appearance.rows.length).toBeGreaterThan(0);
    const app = visibleCategories({ ...ctx, workbench: false }).map((c) => c.id);
    expect(app).toEqual(expect.arrayContaining(['account', 'tokens']));
  });

  it('nests Notifications and API Tokens under Account, directly after it', () => {
    const ids = SETTINGS_CATEGORIES.map((c) => c.id);
    const at = ids.indexOf('account');
    expect(ids.slice(at, at + 3)).toEqual(['account', 'notifications', 'tokens']);
    for (const id of ['notifications', 'tokens'])
      expect(SETTINGS_CATEGORIES.find((c) => c.id === id)!.parent).toBe('account');
    const topLevel = SETTINGS_CATEGORIES.filter((c) => !c.parent).map((c) => c.id);
    expect(topLevel.slice(-2)).toEqual(['account', 'privacy']);
  });

  it('offers API Tokens to a guest too', () => {
    // Its row says why it is empty and links to sign in.
    const ids = visibleCategories({ emailEnabled: false, signedIn: false }).map((c) => c.id);
    expect(ids).toContain('tokens');
  });

  it('has no Webhooks category, for a guest or an account: webhooks are set per document now', () => {
    for (const signedIn of [false, true]) {
      const ids = visibleCategories({ emailEnabled: false, signedIn }).map((c) => c.id);
      expect(ids).not.toContain('webhooks');
    }
  });

  it('shows a guest Your Data the same way: a stand-in that says to sign in', () => {
    const guest = visibleCategories({ emailEnabled: false, signedIn: false });
    const data = guest.find((c) => c.id === 'data')!;
    expect(data.parent).toBe('account');
    expect(data.rows).toEqual([
      expect.objectContaining({ kind: 'note', key: 'dataExportSignIn', signIn: true }),
    ]);
    const ids = visibleCategories({ emailEnabled: false, signedIn: true }).map((c) => c.id);
    expect(ids).not.toContain('data');
    const workbench = visibleCategories({ emailEnabled: false, signedIn: false, workbench: true });
    expect(workbench.map((c) => c.id)).not.toContain('data');
  });

  it('has no row that opens another category: a setting shows where it belongs', () => {
    expect(ALL_ROWS.map((r) => r.kind)).not.toContain('link');
  });

  it('drops the email rows unless mail can be sent AND someone is signed in', () => {
    const withEmail = visibleCategories({ emailEnabled: true, signedIn: true });
    const without = visibleCategories({ emailEnabled: false, signedIn: true });
    const guest = visibleCategories({ emailEnabled: true, signedIn: false });
    const guestRows = guest.find((c) => c.id === 'notifications')!.rows;
    expect(guestRows.map((r) => r.key)).not.toContain('notifyComments');
    // ...but the section still says the settings exist, the same way the API
    // tokens row does, rather than vanishing without explanation.
    expect(guestRows.map((r) => r.key)).toContain('emailSignIn');
    expect(withEmailRows()).not.toContain('emailSignIn');
    function withEmailRows() {
      return visibleCategories({ emailEnabled: true, signedIn: true })
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
    // A teammate assigning you an action emails you (docs/specs/012-collaboration/assigned-actions.md).
    expect(notifyRows(withEmail)).toContain('notifyActionAssigned');
    expect(notifyRows(without)).not.toContain('notifyActionAssigned');
  });

  it('never offers a category with no rows', () => {
    // An empty category is a dead end: a row that pushes a blank pane.
    for (const ctx of BOTH_CONTEXTS) {
      for (const category of visibleCategories(ctx)) {
        expect(category.rows.length, category.id).toBeGreaterThan(0);
      }
    }
  });
});

// Only Account holds sub-categories (docs/specs/007-editor/user-preferences.md); a panel is a section of Panels.
describe('settings sub-categories', () => {
  // Plan has no free canvas: no guides, arrows, element indicators or mouse rows. Its Editor category held only
  // Power user mode's rows, so it went with the mode (docs/specs/007-editor/power-user-mode.md).
  it('has no Editor category', () => {
    expect(SETTINGS_CATEGORIES.map((c) => c.id as string)).not.toContain('editor');
  });

  it('files each panel as a section of Panels, after Panel Opacity', () => {
    expect(SETTINGS_CATEGORIES.filter((c) => c.parent === 'panels')).toEqual([]);
    const panels = SETTINGS_CATEGORIES.find((c) => c.id === 'panels')!;
    expect(panels.rows[0]!.key).toBe('panelOpacity');
    expect([...new Set(panels.rows.slice(1).map((r) => r.section))]).toEqual(['Collaborate']);
    // Their old sub-category ids still land on Panels.
    expect(panels.aliases).toEqual(['collaborate']);
  });

  it('opens every panel section with its Enable switch, on by default', () => {
    const panels = SETTINGS_CATEGORIES.find((c) => c.id === 'panels')!;
    const switches: Record<string, [string, string]> = {
      Collaborate: ['collaboratePanelEnabled', 'Enable Collaborate Panel'],
    };
    for (const [section, [key, label]] of Object.entries(switches)) {
      const row = panels.rows.find((r) => r.section === section)!;
      expect([row.key, row.label]).toEqual([key, label]);
      if (row.kind !== 'toggle') throw new Error(`${key} is not a toggle`);
      expect(row.read({})).toBe(true);
      expect(row.write({}, false)).toEqual({ [key]: false });
    }
  });

  it('offers nested rows only while their parent switch is on', () => {
    const rows = (preferences: UserPreferences) =>
      visibleCategories({ emailEnabled: false, signedIn: false, preferences })
        .find((c) => c.id === 'tours')!
        .rows.map((r) => r.key);
    expect(rows({})).toEqual([
      'planTourSeen',
      'planTourSeen-boards',
      'planTourSeen-sheets',
      'planTourSeen-dashboards',
      'formTourSeen',
    ]);
    expect(rows({ planTourTracks: ['boards', 'sheets', 'dashboards'] })).toEqual([
      'planTourSeen',
      'formTourSeen',
    ]);
  });

  it('names a sub-category by its path', () => {
    const notifications = SETTINGS_CATEGORIES.find((c) => c.id === 'notifications')!;
    expect(settingsCategoryPath(notifications)).toBe('Account › Notifications');
    expect(settingsCategoryPath(SETTINGS_CATEGORIES.find((c) => c.id === 'panels')!)).toBe(
      'Panels',
    );
  });
});

// Only where cursors are drawn (docs/specs/012-collaboration/collaborator-enhancements.md): the row, and so the
// dialog's search over it, follows whether the tab on screen draws other people's cursors.
describe('Hide Participant Cursors row', () => {
  const offered = (cursorsDrawn?: boolean) =>
    visibleCategories({ emailEnabled: true, signedIn: true, cursorsDrawn })
      .flatMap((c) => c.rows)
      .some((r) => r.key === 'hideCursors');

  it('is offered where the tab draws cursors, and when nothing says otherwise', () => {
    expect(offered(true)).toBe(true);
    expect(offered(undefined)).toBe(true);
  });

  it('is absent where the tab draws none', () => {
    expect(offered(false)).toBe(false);
  });
});

// Automatically Open Explorer (liveworkspace/docs/specs/004-index/one-explorer.md "Opening on the Explorer").
describe('Automatically Open Explorer row', () => {
  const explorer = SETTINGS_CATEGORIES.find((category) =>
    category.rows.some((row) => row.key === 'homeBanner'),
  )!;
  const row = explorer.rows.find((r) => r.key === 'autoOpenExplorer')!;

  it('sits in Explorer directly above Show Home Banner', () => {
    expect(explorer.label).toBe('Explorer');
    const keys = explorer.rows.map((r) => r.key);
    expect(keys.indexOf('autoOpenExplorer')).toBe(0);
    expect(keys.indexOf('homeBanner')).toBe(1);
    expect(row.label).toBe('Automatically Open Explorer');
  });

  it('is off by default, and writes only its own key', () => {
    if (row.kind !== 'toggle') throw new Error('expected a toggle');
    expect(row.read({})).toBe(false);
    expect(row.read({ autoOpenExplorer: true })).toBe(true);
    expect(row.write({ homeBanner: false }, true)).toEqual({
      homeBanner: false,
      autoOpenExplorer: true,
    });
    expect(row.event).toEqual({
      category: 'UI',
      on: 'AutoOpenExplorerOn',
      off: 'AutoOpenExplorerOff',
    });
  });
});
