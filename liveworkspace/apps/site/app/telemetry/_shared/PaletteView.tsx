'use client';

import type {
  TelemetryCount,
  TelemetrySummary,
  TelemetryWindowKey,
} from '@liveworkspace/telemetry';
import { CardColumns } from './CardColumns';
import { RankCard, rank } from './RankCard';
import { useTelemetryApp } from './app';
import { rankTrend, windowLabel } from './windows';

// Palette section of the Features tab (docs/specs/017-telemetry/telemetry.md): what people reach for in the editor's creation
// palette, most to least, broken out by the palette's own tabs. Element adds
// (`Element·Added·<type>`) are bucketed into the catalogue categories below.
// The canvas selection modes are a separate concept, not elements, so they
// have their own tab (ModesView). Only items with events in the selected
// window appear.

// The palette tabs come from the app's own catalogue in its api-schema (PALETTE_TELEMETRY_TYPES, its
// config's `palette.tabs`), not a local copy. They used to be hand-mirrored here with a "keep in
// sync" comment, and they didn't stay in sync: this file still expected `Code-block` long after the
// editor settled on `CodeBlock`, so every code block anyone drew was emitted, stored, and silently
// missing from the ranking below. Collaborate shows only for an app whose palette has the tab.

const addedIn = (kinds: readonly string[]) => (r: TelemetryCount) =>
  r.category === 'Element' && r.action === 'Added' && kinds.includes(r.type ?? '');

export function PaletteView({
  summary,
  active,
}: {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  const { palette } = useTelemetryApp();
  const { tabs, subtitles, aliases: PALETTE_TYPE_ALIASES } = palette;
  const rows = summary.windows[active].rows;
  const trend = rankTrend(summary, active);
  const ranked = (tab: string) => rank(rows, addedIn(tabs[tab] ?? []), PALETTE_TYPE_ALIASES);
  const shapes = ranked('shapes');
  const tools = ranked('tools');
  const collaborateSubtitle = tabs.collaborate ? subtitles.collaborate : undefined;
  const collaborate = collaborateSubtitle ? ranked('collaborate') : null;
  const components = ranked('components');
  const devices = ranked('devices');
  const icons = ranked('icons');

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
            subtitle={subtitles.shapes}
            category="Element"
            action="Added"
            items={shapes}
            daily={summary.daily}
            aliases={PALETTE_TYPE_ALIASES}
            emptyLabel="No shapes were added in this window yet."
          />
          {collaborate && collaborateSubtitle ? (
            <RankCard
              trend={trend}
              title="Collaborate"
              subtitle={collaborateSubtitle}
              category="Element"
              action="Added"
              items={collaborate}
              daily={summary.daily}
              aliases={PALETTE_TYPE_ALIASES}
              emptyLabel="No collaboration elements were added in this window yet."
            />
          ) : null}
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
            subtitle={subtitles.devices}
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
