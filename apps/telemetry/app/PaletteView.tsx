'use client';

import { PALETTE_TELEMETRY_TYPES } from '@livediagram/api-schema';
import type { TelemetryCount, TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { CardColumns } from './CardColumns';
import { RankCard, rank } from './RankCard';
import { PALETTE_TYPE_ALIASES } from './palette-types';
import { rankTrend, windowLabel } from './windows';

// Palette view (docs/specs/017-telemetry/telemetry.md): what people reach for in the editor's creation
// palette, most to least, broken out by the palette's own tabs. Element adds
// (`Element·Added·<type>`) are bucketed into the catalogue categories below.
// The canvas selection modes are a separate concept, not elements, so they
// have their own tab (ModesView). Only items with events in the selected
// window appear.

// The palette tabs come from the SHARED catalogue in @livediagram/api-schema
// (docs/specs/017-telemetry/telemetry.md), not a local copy. They used to be hand-mirrored here with a
// "keep in sync" comment, and they didn't stay in sync: this file still
// expected `Code-block` long after the editor settled on `CodeBlock`, so
// every code block anyone drew was emitted, stored, and silently missing
// from the ranking below.
const {
  shapes: SHAPES,
  tools: TOOLS,
  collaborate: COLLABORATE,
  components: COMPONENTS,
  devices: DEVICES,
  icons: ICONS,
} = PALETTE_TELEMETRY_TYPES;

export { PALETTE_TYPE_ALIASES, SELECTION_MODES } from './palette-types';

const addedIn = (kinds: readonly string[]) => (r: TelemetryCount) =>
  r.category === 'Element' && r.action === 'Added' && kinds.includes(r.type ?? '');

export function PaletteView({
  summary,
  active,
}: {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  const rows = summary.windows[active].rows;
  const trend = rankTrend(summary, active);
  const shapes = rank(rows, addedIn(SHAPES), PALETTE_TYPE_ALIASES);
  const tools = rank(rows, addedIn(TOOLS), PALETTE_TYPE_ALIASES);
  const collaborate = rank(rows, addedIn(COLLABORATE), PALETTE_TYPE_ALIASES);
  const components = rank(rows, addedIn(COMPONENTS), PALETTE_TYPE_ALIASES);
  const devices = rank(rows, addedIn(DEVICES), PALETTE_TYPE_ALIASES);
  const icons = rank(rows, addedIn(ICONS), PALETTE_TYPE_ALIASES);

  return (
    <div className="mt-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        What people reach for in the creation palette, for{' '}
        <span className="font-medium">{windowLabel(active)}</span>, most to least used.
      </p>

      <div className="mt-6">
        <CardColumns>
          <RankCard
            trend={trend}
            title="Shapes"
            subtitle="Boxes, circles, flowchart symbols and other primitives"
            category="Element"
            action="Added"
            items={shapes}
            daily={summary.daily}
            aliases={PALETTE_TYPE_ALIASES}
            emptyLabel="No shapes were added in this window yet."
          />
          <RankCard
            trend={trend}
            title="Collaborate"
            subtitle="Estimate cards, temperature checks, idea boxes, agendas, decisions and roll calls"
            category="Element"
            action="Added"
            items={collaborate}
            daily={summary.daily}
            aliases={PALETTE_TYPE_ALIASES}
            emptyLabel="No collaboration elements were added in this window yet."
          />
          <RankCard
            trend={trend}
            title="Tools"
            subtitle="Text, arrows, stickies, tables, charts and other building blocks"
            category="Element"
            action="Added"
            items={tools}
            daily={summary.daily}
            aliases={PALETTE_TYPE_ALIASES}
            emptyLabel="No tools were added in this window yet."
          />
          <RankCard
            trend={trend}
            title="Components"
            subtitle="Pre-built blocks: banners, heroes, callouts, stat rows and more"
            category="Element"
            action="Added"
            items={components}
            daily={summary.daily}
            aliases={PALETTE_TYPE_ALIASES}
            emptyLabel="No components were added in this window yet."
          />
          <RankCard
            trend={trend}
            title="Devices"
            subtitle="Wireframe frames: browser, phone, laptop and friends"
            category="Element"
            action="Added"
            items={devices}
            daily={summary.daily}
            aliases={PALETTE_TYPE_ALIASES}
            emptyLabel="No device frames were added in this window yet."
          />
          <RankCard
            trend={trend}
            title="Icons"
            subtitle="Line-art icons and brand / technology marks"
            category="Element"
            action="Added"
            items={icons}
            daily={summary.daily}
            aliases={PALETTE_TYPE_ALIASES}
            emptyLabel="No icons were added in this window yet."
          />
        </CardColumns>
      </div>
    </div>
  );
}
