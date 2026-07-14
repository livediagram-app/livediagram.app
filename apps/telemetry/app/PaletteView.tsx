'use client';

import type { TelemetryCount, TelemetrySummary, TelemetryWindowKey } from '@livediagram/api-schema';
import { RankCard, rank } from './RankCard';
import { windowLabel } from './windows';

// Palette view (spec/22): what people reach for in the editor's creation
// palette, most to least, broken out by the palette's own tabs. Element adds
// (`Element·Added·<type>`) are bucketed into the catalogue categories below;
// the canvas Selection modes are a separate concept (`Canvas·Used·<mode>`),
// not palette elements, so they get their own card. Only items with events in
// the selected window appear.

// The palette tabs, mirrored from apps/live's palette-create-tabs + the
// CommandPalette device/icon tabs. Keep in sync if the palette gains items.
const SHAPES = new Set([
  'Square',
  'Circle',
  'Diamond',
  'Cylinder',
  'Parallelogram',
  'Hexagon',
  'Document',
  'Stadium',
  'Cloud',
  'Triangle',
  'Trapezoid',
  'Star',
  'Speech-bubble',
]);
const TOOLS = new Set([
  'Text',
  'Freehand',
  'Arrow',
  'Sticky',
  'Table',
  'Image',
  'Avatar',
  'Actor',
  'Frame',
  'Annotation',
  'LinkCard',
  'Highlighter',
  'Polygon',
  'Polyline',
  'Timeline-rail',
  'Code-block',
  'Checklist',
  'Pie-chart',
  'Bar-chart',
  'Line-chart',
  'Progress-bar',
  'Progress-ring',
  'Rating',
]);
const COMPONENTS = new Set(['Banner', 'Hero', 'Header', 'Callout', 'StatRow', 'ProcessSteps']);
const DEVICES = new Set(['Browser', 'Monitor', 'Laptop', 'Phone', 'Tablet', 'Smartwatch']);
const ICONS = new Set(['Icon', 'TechIcon']);

const addedIn = (kinds: Set<string>) => (r: TelemetryCount) =>
  r.category === 'Element' && r.action === 'Added' && kinds.has(r.type ?? '');

export function PaletteView({
  summary,
  active,
}: {
  summary: TelemetrySummary;
  active: TelemetryWindowKey;
}) {
  const rows = summary.windows[active].rows;
  const shapes = rank(rows, addedIn(SHAPES));
  const tools = rank(rows, addedIn(TOOLS));
  const components = rank(rows, addedIn(COMPONENTS));
  const devices = rank(rows, addedIn(DEVICES));
  const icons = rank(rows, addedIn(ICONS));
  const modes = rank(rows, (r) => r.category === 'Canvas' && r.action === 'Used');

  return (
    <div className="mt-8">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        What people reach for in the creation palette, for{' '}
        <span className="font-medium">{windowLabel(active)}</span>, most to least used.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <RankCard
          title="Shapes"
          subtitle="Boxes, circles, flowchart symbols and other primitives"
          category="Element"
          action="Added"
          items={shapes}
          daily={summary.daily}
          emptyLabel="No shapes were added in this window yet."
        />
        <RankCard
          title="Tools"
          subtitle="Text, arrows, stickies, tables, charts and other building blocks"
          category="Element"
          action="Added"
          items={tools}
          daily={summary.daily}
          emptyLabel="No tools were added in this window yet."
        />
        <RankCard
          title="Components"
          subtitle="Pre-built blocks: banners, heroes, callouts, stat rows and more"
          category="Element"
          action="Added"
          items={components}
          daily={summary.daily}
          emptyLabel="No components were added in this window yet."
        />
        <RankCard
          title="Devices"
          subtitle="Wireframe frames: browser, phone, laptop and friends"
          category="Element"
          action="Added"
          items={devices}
          daily={summary.daily}
          emptyLabel="No device frames were added in this window yet."
        />
        <RankCard
          title="Icons"
          subtitle="Line-art icons and brand / technology marks"
          category="Element"
          action="Added"
          items={icons}
          daily={summary.daily}
          emptyLabel="No icons were added in this window yet."
        />
        <RankCard
          title="Selection modes"
          subtitle="Canvas modes: laser, spotlight, eraser, format painter, isometric"
          category="Canvas"
          action="Used"
          items={modes}
          daily={summary.daily}
          emptyLabel="No selection modes were used in this window yet."
        />
      </div>
    </div>
  );
}
