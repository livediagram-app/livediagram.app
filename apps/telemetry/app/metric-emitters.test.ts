import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { GROUPS as EDITING } from './EditingView';
import { SETTINGS_CHANGED, SETTINGS_STACKS } from './metric-catalogue';
import { GROUPS as SETTINGS } from './SettingsView';
import { COMPUTED_EMITTERS, TOUR_STEP_SOURCE } from './computed-emitters';
import { COMPUTED, scanEmitters, type Emit } from './emitter-scan';
import { GROUPS as EXCEPTIONS, RECOVERY_TYPES } from './ExceptionsView';
import { GROUPS as HELP } from './HelpView';
import { GROUPS as DASHBOARD } from './DashboardView';
import {
  CUSTOM_THEME_METRICS,
  CUSTOM_THEME_TYPES,
  NON_PATTERN_CANVAS_TYPES,
  THEME_ALIASES,
} from './LookAndFeelView';
import * as CATALOGUE from './metric-catalogue';
import {
  groupMetrics,
  headlineMembers,
  isStack,
  matches,
  type Metric,
  type MetricGroup,
} from './metric-series';
import { SELECTION_MODES } from './PaletteView';
import { TOUR_STEP_TYPES } from './tour-steps';

// Every card and every hard-coded ranking type on the dashboard must be an
// event something in the repo can actually send. Two ways that went wrong:
//
//  - A card that asks for `type: null` counts ONLY the bare event. When an
//    emitter started typing Diagram·Created `Cloud` / `Offline`, "Diagrams
//    Created" silently read 0 for months. So an untyped card must have no
//    emitter that can send a type (a card that wants them says `allTypes` or
//    `typeIn`).
//  - A card that asks for a specific type counts nothing if the emitter sends
//    it under another category: "AI Turned On" read UI·Toggled·AiOn while the
//    Settings row sends AI·Toggled·AiOn. So a typed card must have an emitter
//    that can send exactly that category·action·type.
//
// emitter-scan.ts resolves literals, ternaries, lookup tables, forwarding
// helpers, the api worker's own inserts, and the Settings catalogue. What it
// cannot resolve is COMPUTED: each computed site declares the values it can
// send in computed-emitters.ts, and every check below reads those values as
// if they were literals.

const REPO = resolve(__dirname, '../../..');
// The dashboard reads events, it never emits them.
const EMITS = scanEmitters(REPO, ['apps', 'packages'], join(REPO, 'apps', 'telemetry'));

type Known = Emit & { category: string; action: string };
const KNOWN = EMITS.filter(
  (e): e is Known => typeof e.category === 'string' && typeof e.action === 'string',
);

// Emit sites whose category or action is itself a variable. Each is a generic
// pass-through whose real events are scanned at their source instead; a new
// file here means an emitter the scan can't see, so extend the scan (or add it
// here with the reason) rather than let its events go unchecked.
const DYNAMIC_EMITTERS: Record<string, string> = {
  'apps/live/components/dialogs/settings/SettingsCategoryPane.tsx':
    'emits each Settings catalogue row; the rows themselves are scanned',
  'apps/live/components/tour/TourLayoutPicker.tsx':
    "the welcome tour's panel-layout choice, re-emitting the Settings catalogue's panelLayout row (scanned there)",
  'apps/api/src/routes/events.ts': 'the ingest endpoint, writing validated client events',
  'apps/api/src/server-telemetry.ts':
    'reportServerEvent, the api worker helper; its callers are scanned as emitters',
};

// A computed emitter's values (computed-emitters.ts), by its site key.
const siteKey = (e: Known) => `${e.path} ${e.category}·${e.action}`;
const declared = (e: Known): readonly (string | null)[] =>
  COMPUTED_EMITTERS[siteKey(e)]?.values ?? [];
const COMPUTED_SITES = KNOWN.filter((e) => e.type === COMPUTED);

// Every event an emitter can send, computed sites expanded to their values.
const SENDS = KNOWN.flatMap((e) =>
  e.type === COMPUTED ? declared(e).map((type) => ({ ...e, type })) : [e],
);

function sendable(category: string, action: string, type: string | null): boolean {
  return SENDS.some((e) => e.category === category && e.action === action && e.type === type);
}

const ALL: MetricGroup[] = [...DASHBOARD, ...EDITING, ...SETTINGS, ...EXCEPTIONS, ...HELP];
// Plus every catalogue chart, including ones parked off every tab, so a chart
// waiting to be added back can't rot while it is out of view.
const METRICS = [
  ...ALL.flatMap(groupMetrics),
  ...Object.values(CATALOGUE)
    .flat()
    .flatMap((item) => (isStack(item) ? item.members : [item])),
];
const UNTYPED = METRICS.filter((m) => !m.allTypes && !m.typeIn && (m.type ?? null) === null);
const TYPED = METRICS.filter((m) => !m.allTypes && !m.typeIn && typeof m.type === 'string');

describe('the emitter scan', () => {
  it('sees each emitter form the dashboard depends on', () => {
    // Guards the scan itself: a path or parser slip would pass every card below.
    const has = (c: string, a: string, t: string | null) =>
      KNOWN.some((e) => e.category === c && e.action === a && e.type === t);
    expect(has('Diagram', 'Exported', COMPUTED as never) || has('Diagram', 'Exported', 'PNG')).toBe(
      true,
    );
    expect(has('AI', 'Toggled', 'AiOn')).toBe(true); // Settings catalogue row
    expect(has('Tab', 'Moved', 'Folder')).toBe(true); // ternary action
    expect(has('Tab', 'Removed', 'Folder')).toBe(true);
    expect(has('Diagram', 'Created', 'Offline')).toBe(true); // ternary type
    expect(has('Canvas', 'Changed', 'BackgroundColor')).toBe(true); // returned closure
    // A callback's parameter, bound through the calls createVoteTally makes.
    expect(has('Help', 'Helpful', COMPUTED as never)).toBe(true);
    expect(has('Help', 'Unhelpful', COMPUTED as never)).toBe(true);
    expect(has('Session', 'SignedUp', null)).toBe(true); // reportServerEvent(env, ...), const action
    expect(has('Email', 'Sent', COMPUTED as never)).toBe(true);
    expect(KNOWN.some((e) => e.category === 'Error' && e.path.startsWith('apps/mcp/'))).toBe(true);
    expect(KNOWN.some((e) => e.category === 'Error' && e.path === 'apps/api/src/index.ts')).toBe(
      true,
    );
    expect(UNTYPED.length).toBeGreaterThan(0);
    expect(TYPED.length).toBeGreaterThan(0);
  });

  it('has no unexplained dynamic emitter', () => {
    const dynamic = [
      ...new Set(EMITS.filter((e) => !KNOWN.includes(e as Known)).map((e) => e.path)),
    ];
    expect(dynamic.sort()).toEqual(Object.keys(DYNAMIC_EMITTERS).sort());
  });
});

describe('metric cards', () => {
  it.each(METRICS.map((m) => [m.title, m.category, m.action] as const))(
    '%s (%s·%s) has an emitter',
    (_title, category, action) => {
      expect(KNOWN.some((e) => e.category === category && e.action === action)).toBe(true);
    },
  );

  it.each(UNTYPED.map((m) => [m.title, m.category, m.action] as const))(
    '%s (%s·%s) has no typed emitter the card would miss',
    (_title, category, action) => {
      const typed = KNOWN.filter(
        (e) => e.category === category && e.action === action && e.type !== null,
      );
      expect(typed.map((e) => e.path)).toEqual([]);
    },
  );

  it.each(TYPED.map((m) => [m.title, m.category, m.action, m.type as string] as const))(
    '%s (%s·%s·%s) is an event something sends',
    (_title, category, action, type) => {
      expect(sendable(category, action, type)).toBe(true);
    },
  );
});

describe('hard-coded ranking types', () => {
  const triples: [string, string, string, string][] = [
    ...SELECTION_MODES.map(
      (t) => ['Selection modes', 'Canvas', 'Used', t] as [string, string, string, string],
    ),
    ...NON_PATTERN_CANVAS_TYPES.map(
      (t) =>
        ['Canvas styles exclusion', 'Canvas', 'Changed', t] as [string, string, string, string],
    ),
    ...[...CUSTOM_THEME_TYPES].map(
      (t) => ['Themes exclusion', 'Theme', 'Changed', t] as [string, string, string, string],
    ),
    ...Object.values(THEME_ALIASES).map(
      (t) => ['Themes alias target', 'Theme', 'Changed', t] as [string, string, string, string],
    ),
    ...CUSTOM_THEME_METRICS.map(
      (m) =>
        ['Custom theme builder', m.category, m.action, m.type] as [string, string, string, string],
    ),
    ...RECOVERY_TYPES.map(
      (t) => ['Exceptions recovery', 'Error', 'Client', t] as [string, string, string, string],
    ),
  ];
  it.each(triples)('%s: %s·%s·%s is an event something sends', (_where, c, a, t) => {
    expect(sendable(c, a, t)).toBe(true);
  });
});

describe('computed emitters', () => {
  it('each declare the values they can send', () => {
    const sites = [...new Set(COMPUTED_SITES.map(siteKey))].sort();
    expect(sites).toEqual(Object.keys(COMPUTED_EMITTERS).sort());
  });

  it.each(Object.entries(COMPUTED_EMITTERS))('%s lists at least one value', (_site, spec) => {
    expect(spec.values.length).toBeGreaterThan(0);
  });

  it('read the tour steps the editor sends, in the order the Help tab ranks them', () => {
    expect(TOUR_STEP_SOURCE.length).toBeGreaterThan(5);
    expect([...TOUR_STEP_TYPES]).toEqual(TOUR_STEP_SOURCE);
  });
});

describe('the Settings tab', () => {
  it('has a chart for every Settings row the editor emits', () => {
    const charts = SETTINGS_STACKS.flatMap((s) => s.members);
    const rows = KNOWN.filter((e) => e.path.endsWith('settings-catalogue.ts'));
    expect(rows.length).toBeGreaterThan(20);
    const missing = rows.filter(
      (e) =>
        typeof e.type === 'string' &&
        !charts.some(
          (m) => m.category === e.category && m.action === e.action && m.typeIn?.(e.type as string),
        ),
    );
    expect(missing.map((e) => `${e.category}·${e.action}·${String(e.type)}`)).toEqual([]);
  });
});

// The pattern's promise (docs/specs/017-telemetry/telemetry.md): every event the repo can send lands in a
// chart on some tab, so nothing is reachable only through Search. A new
// emitter with no chart fails here; give it one (usually a member of an
// existing stack) or, if it is genuinely not worth a chart, list it below with
// the reason.
const NO_CHART: Record<string, string> = {
  // The scan follows endTour's outcome into track('UI', 'Ended', outcome) but
  // can't see the `if` in front of it: a decline is sent as UI·Closed·TourOffer
  // (the Tours Declined chart), never as UI·Ended·TourDeclined.
  'UI·Ended·TourDeclined': 'apps/live TourHost.tsx endTour, routed to UI·Closed·TourOffer',
};

describe('every event has a chart', () => {
  const charts = ALL.flatMap(groupMetrics);
  // A computed site counts through each value it declares, so a value no
  // chart counts is an orphan like any literal one.
  const home = (e: (typeof SENDS)[number]) =>
    charts.some((m) => matches(m, e.category, e.action, e.type as string | null));
  const orphans = SENDS.filter(
    (e) => !home(e) && !(`${e.category}·${e.action}·${String(e.type)}` in NO_CHART),
  );
  it('finds a chart for every event an emitter can send', () => {
    expect(
      [
        ...new Set(
          orphans.map(
            (e) =>
              `${e.category}·${e.action}·${String(e.type)}  (${e.path.split('/').slice(-2).join('/')})`,
          ),
        ),
      ].sort(),
    ).toEqual([]);
  });
});

// One event counted by two different charts is how the dashboard double
// counts (Tabs Cleared once caught every discarded vote; Share Links Copied
// caught team invite copies). Two overlaps are by design, and only these:
//  - a Settings Changed category chart rolls up the setting charts in it;
//  - inside one stack, a chart and its subset, with the headline counting
//    only one of them (AI Requests over Ask / Clean, Returning Visitors over
//    its guest / signed-in split), so the head never adds them together.
describe('no event is counted by two unrelated charts', () => {
  const stacks = ALL.flatMap((g) => g.metrics).filter(isStack);
  const rollups = new Set<Metric>(SETTINGS_CHANGED.members);
  const subsetPair = (a: Metric, b: Metric) =>
    stacks.some((s) => {
      const i = s.members.indexOf(a);
      const j = s.members.indexOf(b);
      if (i < 0 || j < 0) return false;
      const inHead = headlineMembers(s);
      return s.headline !== undefined && inHead[i] !== inHead[j];
    });
  const charts = [...new Set(ALL.flatMap(groupMetrics))];
  const clashes = SENDS.flatMap((e) => {
    const hits = charts.filter((m) => matches(m, e.category, e.action, e.type as string | null));
    const bad: string[] = [];
    for (let i = 0; i < hits.length; i++) {
      for (let j = i + 1; j < hits.length; j++) {
        const [a, b] = [hits[i]!, hits[j]!];
        if (rollups.has(a) || rollups.has(b) || subsetPair(a, b)) continue;
        bad.push(`${e.category}·${e.action}·${String(e.type)}: ${a.title} + ${b.title}`);
      }
    }
    return bad;
  });
  it('finds only the rollups and headline subsets that are meant to overlap', () => {
    expect([...new Set(clashes)].sort()).toEqual([]);
  });
});
