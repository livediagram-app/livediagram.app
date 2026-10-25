'use client';

// The photo tools (docs/specs/031-photo/photo-pages.md "The photo tools"): each button a tool group showing its last
// used tool. A press takes that tool; a press on the tool in hand opens its options, whose Tool section holds the
// group's other tools (no long press). In the palette strip (`placement="strip"`) the tools used most are buttons and
// the rest sit in their categories (PhotoToolCategories), then the colours; a phone shows every group as one row at
// the bottom (`placement="row"`, PhotoChrome places it), a tap on the tool in hand opening its options sheet.
import { Fragment, useEffect } from 'react';
import { Tooltip } from '@livedesign/ui';
import { CLUSTER_STRIP } from '@liveworkspace/workbench/components/canvas/cluster-strip';
import {
  GROUP_KEYS,
  photoTools,
  TOOL_CATEGORIES,
  TOOL_GROUPS,
  TOOL_NAMES,
  usePhotoTools,
  type PhotoToolId,
  type ToolGroup,
} from '@/lib/photo-editor/tool-state';
import { railShown } from '@/lib/photo-editor/rail-shown';
import { toolFlyout } from '@/lib/photo-editor/tool-flyout';
import { Divider } from '@/components/palette/strip-rail-items';
import { TOOL_ICONS } from './photo-icons';
import { PhotoColours } from './PhotoColours';
import { PhotoToolCategories } from './PhotoToolCategories';
import { PINNED_GROUPS } from '@/lib/photo-editor/tool-categories';

/** A tool taken from the rail or a shortcut. */
export function takeTool(tool: PhotoToolId): void {
  photoTools.take(tool);
}

/** A tool pressed in the palette: another tool is only taken (its options stay shut); the one already in hand
 *  opens or closes its options flyout. */
export function pressTool(tool: PhotoToolId): void {
  if (photoTools.get().tool === tool) {
    toolFlyout.toggle();
    return;
  }
  photoTools.take(tool);
  toolFlyout.close();
}

function GroupButton({
  group,
  current,
  shown,
  placement,
}: {
  group: ToolGroup;
  current: PhotoToolId | null;
  shown: PhotoToolId;
  placement: ToolsPlacement;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const Icon = TOOL_ICONS[shown];
  const on = !!current && group.tools.includes(current);
  const key = GROUP_KEYS[group.id]?.toUpperCase();
  const label = `${TOOL_NAMES[shown]}${key ? ` (${key})` : ''}`;
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={on}
        // Another tool is taken; the one in hand opens its options (a flyout, or a phone's sheet), whose Tool section
        // holds the group's other tools.
        onClick={() => pressTool(shown)}
        className={`relative flex h-9 w-9 shrink-0 items-center justify-center ${
          placement === 'strip' ? 'rounded-md' : ''
        } ${
          on
            ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200'
            : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
        }`}
      >
        <Icon />
      </button>
    </Tooltip>
  );
}

const groupById = new Map(TOOL_GROUPS.map((g) => [g.id, g]));
// The strip's own buttons (tool-categories): the tools used most.
const PINNED = PINNED_GROUPS.map((id) => groupById.get(id)!);
const PINNED_IDS: ReadonlySet<string> = new Set(PINNED_GROUPS);
// The categories with their groups; a Participant's holds the Eyedropper alone (photo-pages.md "Share roles").
const CATEGORIES = TOOL_CATEGORIES.map((c) => ({
  ...c,
  groups: c.groups.map((id) => groupById.get(id)!),
}));
const INSPECT_CATEGORIES = CATEGORIES.filter((c) =>
  c.groups.some((g) => g.id === 'eyedropper'),
).map((c) => ({ ...c, groups: c.groups.filter((g) => g.id === 'eyedropper') }));

export type ToolsPlacement = 'strip' | 'row';

export function PhotoToolsRail({
  placement = 'strip',
  inspect = false,
}: {
  placement?: ToolsPlacement;
  inspect?: boolean;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const { tool, lastInGroup } = usePhotoTools();
  const categories = inspect ? INSPECT_CATEGORIES : CATEGORIES;
  // On screen: the photo page frames beside it (usePhotoFraming).
  useEffect(() => railShown.mount(), []);
  return (
    <div
      data-photo-rail=""
      role="toolbar"
      aria-label="Photo Tools"
      aria-orientation="horizontal"
      className={
        placement === 'row'
          ? `${CLUSTER_STRIP} max-w-full flex-row overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden`
          : 'flex items-center gap-0.5'
      }
    >
      {placement === 'strip' && !inspect ? (
        <>
          {/* The tools used most, each its own button; the rest in their categories (tool-categories). */}
          <div role="group" aria-label="Pinned Tools" className="flex items-center gap-0.5">
            {PINNED.map((g) => (
              <GroupButton
                key={g.id}
                group={g}
                current={tool}
                shown={lastInGroup[g.id] ?? g.tools[0]!}
                placement={placement}
              />
            ))}
          </div>
          <Divider />
          <PhotoToolCategories pinned={PINNED_IDS} />
          <Divider />
        </>
      ) : (
        categories.map((c, i) => (
          <Fragment key={c.id}>
            {i ? <Divider /> : null}
            <div role="group" aria-label={c.name} className="flex items-center gap-0.5">
              {c.groups.map((g) => (
                <GroupButton
                  key={g.id}
                  group={g}
                  current={tool}
                  shown={lastInGroup[g.id] ?? g.tools[0]!}
                  placement={placement}
                />
              ))}
            </div>
          </Fragment>
        ))
      )}
      <PhotoColours />
    </div>
  );
}
