import { describe, expect, it } from 'vitest';
import { HELP_ARTICLES } from '@/lib/help-articles';
import { SETTINGS_CATEGORIES, settingsCategoryPath, visibleCategories } from './settings-catalogue';
import { TELEMETRY_TYPE_PATTERN } from '@livehuddle/api-schema';
import type { SettingsRowSpec } from './settings-catalogue';
import type { UserPreferences } from '@/lib/user-preferences';

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
  // The Auto-Attach Arrows setting left livehuddle (Work Tracker #423, part 4): arrows always reattach after a
  // move, and the stored key is left unread.
  it('offers no Auto-Attach Arrows setting', () => {
    const keys = SETTINGS_CATEGORIES.flatMap((c) => c.rows.map((r) => r.key ?? ''));
    expect(keys).not.toContain('autoRebindArrows');
  });

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

  // docs/specs/007-editor/user-preferences.md "Tours": a category of its own, one switch per tour in
  // the order the tours come.
  it('gives the tours a category of their own, a switch each with its own article', () => {
    const tours = SETTINGS_CATEGORIES.find((c) => c.id === 'tours')!;
    expect(tours.rows.map((r) => [r.key, r.kind, r.label, r.helpArticle])).toEqual([
      ['avatarTourSeen', 'toggle', 'Avatar Tour', 'avatarTour'],
      // Element tours (docs/specs/007-editor/element-tours.md): one switch over them all, then one per element,
      // linking that element's article.
      ['elementToursSeen', 'toggle', 'Show Me on Every Element', undefined],
      ['elementTour-timeline', 'toggle', 'Timeline', 'timelineRail'],
      ['elementTour-chart', 'toggle', 'Chart', 'dataElements'],
      ['elementTour-stack', 'toggle', 'Stack', 'stacks'],
      ['elementTour-lane', 'toggle', 'Lane', 'lanes'],
      ['elementTour-boundary', 'toggle', 'Boundary', 'boundaries'],
      ['elementTour-diagram-key', 'toggle', 'Diagram Key', 'diagramKeys'],
      ['elementTour-portal', 'toggle', 'Portal', 'portals'],
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
        ['AvatarTourSeenOff', 'AvatarTourSeenOn'],
        ['ElementToursSeenOff', 'ElementToursSeenOn'],
        ['TimelineTourSeenOff', 'TimelineTourSeenOn'],
        ['ChartTourSeenOff', 'ChartTourSeenOn'],
        ['StackTourSeenOff', 'StackTourSeenOn'],
        ['LaneTourSeenOff', 'LaneTourSeenOn'],
        ['BoundaryTourSeenOff', 'BoundaryTourSeenOn'],
        ['DiagramKeyTourSeenOff', 'DiagramKeyTourSeenOn'],
        ['PortalTourSeenOff', 'PortalTourSeenOn'],
      ],
    );
  });

  // A phone has no middle button: the Mouse section's row is inert there, as the Map's are.
  it('makes the Mouse section desktop only', () => {
    const rows = SETTINGS_CATEGORIES.flatMap((c) => c.rows).filter(
      (r) => 'section' in r && r.section === 'Mouse',
    );
    // Quick-Add on Hover left with Quick Connect (docs/specs/002-project-scope/not-in-livehuddle.md#quick-connect).
    expect(rows.map((r) => r.key)).toEqual(['middleMousePan']);
    for (const row of rows) expect(row.desktopOnly).toMatch(/A mouse setting/);
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
    const before: UserPreferences = { alignmentGuides: false, telemetryEnabled: false };
    // A tour of several tracks also writes its answered list (lib/tour-tracks.ts).
    const own: Record<string, string[]> = {
      elementToursSeen: ['elementToursSeen', 'elementTourKinds'],
      // One element's tour writes the answered list alone (lib/element-tours.ts).
      'elementTour-sankey': ['elementTourKinds'],
      'elementTour-layer-stack': ['elementTourKinds'],
      'elementTour-pyramid': ['elementTourKinds'],
      'elementTour-funnel': ['elementTourKinds'],
      'elementTour-cycle': ['elementTourKinds'],
      'elementTour-hub': ['elementTourKinds'],
      'elementTour-onion': ['elementTourKinds'],
      'elementTour-timeline': ['elementTourKinds'],
      'elementTour-chevrons': ['elementTourKinds'],
      'elementTour-mind-node': ['elementTourKinds'],
      'elementTour-flowchart': ['elementTourKinds'],
      'elementTour-org-chart': ['elementTourKinds'],
      'elementTour-sequence': ['elementTourKinds'],
      'elementTour-chart': ['elementTourKinds'],
      'elementTour-stack': ['elementTourKinds'],
      'elementTour-entity': ['elementTourKinds'],
      'elementTour-lane': ['elementTourKinds'],
      'elementTour-boundary': ['elementTourKinds'],
      'elementTour-diagram-key': ['elementTourKinds'],
      'elementTour-portal': ['elementTourKinds'],
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

  it('offers the account, its tokens and the Appearance choice to a signed-in person', () => {
    const categories = visibleCategories({ emailEnabled: true, signedIn: true });
    expect(categories.map((c) => c.id)).toEqual(
      expect.arrayContaining(['account', 'tokens', 'editor']),
    );
    const appearance = categories.find((c) => c.id === 'appearance')!;
    expect(appearance.rows.some((r) => r.kind === 'appearance')).toBe(true);
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

  it('shows a guest Webhooks as API Tokens is shown them: a stand-in that says to sign in', () => {
    // Signed in, the Account section's own Webhooks (a link to liveworkspace's Settings) stands in its place.
    const guest = visibleCategories({ emailEnabled: false, signedIn: false });
    const webhooks = guest.find((c) => c.id === 'webhooks')!;
    expect(webhooks.parent).toBe('account');
    expect(webhooks.rows).toEqual([
      expect.objectContaining({ kind: 'note', key: 'webhooksSignIn', signIn: true }),
    ]);
    const ids = visibleCategories({ emailEnabled: false, signedIn: true }).map((c) => c.id);
    expect(ids).not.toContain('webhooks');
  });

  it('points every link row at a category that exists', () => {
    const ids = new Set(SETTINGS_CATEGORIES.map((c) => c.id));
    const links = ALL_ROWS.filter((r) => r.kind === 'link');
    expect(links.length).toBeGreaterThan(0);
    for (const row of links) expect(ids.has(row.target), row.key).toBe(true);
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

// Editor and Panels hold sub-categories (docs/specs/007-editor/user-preferences.md), each its own pane.
describe('settings sub-categories', () => {
  // livehuddle has no presenting (docs/specs/002-project-scope/not-in-livehuddle.md, Work Tracker #423 part 2).
  it('offers no Presenting settings', () => {
    expect(SETTINGS_CATEGORIES.filter((c) => c.parent === 'editor')).toEqual([]);
    const keys = SETTINGS_CATEGORIES.flatMap((c) => c.rows.map((r) => r.key ?? ''));
    expect(keys.filter((k) => k.startsWith('presentation'))).toEqual([]);
  });

  it('keeps every setting that acts in both modes on Editor itself', () => {
    const keys = SETTINGS_CATEGORIES.find((c) => c.id === 'editor')!.rows.map((r) => r.key);
    expect(keys).toEqual(['alignmentGuides', 'elementIndicatorStyle', 'middleMousePan']);
  });

  it('nests one sub-category per panel under Panels, directly after it and in order', () => {
    const ids = SETTINGS_CATEGORIES.map((c) => c.id);
    const children = SETTINGS_CATEGORIES.filter((c) => c.parent === 'panels').map((c) => c.id);
    expect(children).toEqual(['map', 'collaborate']);
    const at = ids.indexOf('panels');
    expect(ids.slice(at + 1, at + 1 + children.length)).toEqual(children);
  });

  it('keeps Panel Opacity on Panels itself, and Enable Map under Map', () => {
    const keys = (id: string) =>
      SETTINGS_CATEGORIES.find((c) => c.id === id)!.rows.map((r) => r.key);
    expect(keys('panels')).toEqual(['panelOpacity']);
    expect(keys('map')[0]).toBe('showMinimap');
  });

  it('opens every panel sub-category with its Enable switch, on by default', () => {
    const first = (id: string) => SETTINGS_CATEGORIES.find((c) => c.id === id)!.rows[0]!;
    const switches: Record<string, [string, string]> = {
      map: ['showMinimap', 'Enable Map'],
      collaborate: ['collaboratePanelEnabled', 'Enable Collaborate Panel'],
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
      visibleCategories({ emailEnabled: false, signedIn: false, preferences })
        .find((c) => c.id === id)!
        .rows.map((r) => r.key);
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
