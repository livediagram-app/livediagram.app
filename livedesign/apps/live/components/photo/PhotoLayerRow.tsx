'use client';

// One row of the Layers tab (docs/specs/031-photo/photo-layers.md "The Layers tab"): the eye (Alt
// shows only this layer, again restores), the thumbnail and the mask's (a press on either makes it
// the target of painting, ringed), the name (double-click to rename), and the clip, lock, effects and
// fold marks; a press makes it active, Shift and Ctrl/Cmd add it to the chosen; its menu holds the
// layer's operations. 48 px high, the name over a line saying what it is (its kind, its blend mode and opacity
// when not the usual, Hidden); a group's layers indented under it.
import { useMemo, useState, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react';
import type { RowDropAt } from '@/components/primitives/useRowPointerDrag';
import {
  lucideArrowDownToLine,
  lucideArrowUpToLine,
  lucideCheck,
  lucideChevronDown,
  lucideChevronRight,
  lucideCircleX,
  lucideContrast,
  lucideCopy,
  lucideDownload,
  lucideEye,
  lucideEyeOff,
  lucideFolder,
  lucideFolderX,
  lucideGrid3x3,
  lucideGroup,
  lucideImage,
  lucideLassoSelect,
  lucideLayers,
  lucideLock,
  lucideMerge,
  lucidePaintBucket,
  lucideSlidersHorizontal,
  lucideSparkles,
  lucideSquareDashed,
  lucideSquareDashedMousePointer,
  lucideTextCursorInput,
  lucideTrash2,
  lucideType,
  lucideWandSparkles,
} from '@liveworkspace/icons/lucide';
import { lucideGlyph, Tooltip } from '@livedesign/ui';
import { BLEND_MODE_NAMES, type PhotoLayer } from '@livedesign/photo-engine';
import { EllipsisTriggerButton } from '@liveworkspace/workbench/components/primitives/EllipsisTriggerButton';
import { InlineRenameInput } from '@/components/primitives/InlineRenameInput';
import {
  MenuActionRow,
  MenuGroupSeparator,
  PortalMenu,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { useRowMenu } from '@liveworkspace/workbench/components/primitives/useRowMenu';
import type { PhotoSession } from '@/lib/photo-editor/session';
import { layerThumbnail } from '@/lib/photo-editor/thumbnails';
import { RasterThumb } from './RasterThumb';
import { useLockShake } from '@/lib/photo-editor/lock-shake';

const Eye = lucideGlyph(lucideEye, 14);
const EyeOff = lucideGlyph(lucideEyeOff, 14);
const Lock = lucideGlyph(lucideLock, 11);
const Open = lucideGlyph(lucideChevronDown, 12);
const Closed = lucideGlyph(lucideChevronRight, 12);
const KIND_ICON = {
  group: lucideGlyph(lucideFolder, 16),
  text: lucideGlyph(lucideType, 16),
  adjustment: lucideGlyph(lucideSlidersHorizontal, 16),
  fill: lucideGlyph(lucidePaintBucket, 16),
};

const KIND_NAME: Record<PhotoLayer['layerKind'], string> = {
  pixel: 'pixel layer',
  text: 'text layer',
  adjustment: 'adjustment layer',
  fill: 'fill layer',
  group: 'group',
};

/** A row's second line: what the layer is, and its blend and opacity when not the usual. */
export function describeLayer(layer: PhotoLayer, pct: number, shown: boolean): string {
  const kind = KIND_NAME[layer.layerKind];
  const parts = [kind.charAt(0).toUpperCase() + kind.slice(1)];
  if (layer.blend && layer.blend !== 'normal' && layer.blend !== 'pass-through')
    parts.push(BLEND_MODE_NAMES[layer.blend]);
  if (pct < 100) parts.push(`${pct}%`);
  if (!shown) parts.push('Hidden');
  return parts.join(' · ');
}

export type LayerRowMenu = {
  id: string;
  label: string;
  // The group it sits in: a separator between groups (photo-layers.md "Layer operations").
  section: number;
  icon: ReturnType<typeof lucideGlyph>;
  when?: (l: PhotoLayer) => boolean;
};

const g = (icon: Parameters<typeof lucideGlyph>[0]) => lucideGlyph(icon, 16);

// A row's menu, as the canvas's own Layers panel menu reads (LayerRowMenu): a header naming the layer, then each verb
// a row with its icon, in groups (arrange, merge, mask and clipping, pixels), and Delete Layer last on its own. Each
// runs with the layer made active. Verbs for what a layer has not got (a mask's, a group's) are left out.
export const ROW_MENU: readonly LayerRowMenu[] = [
  { id: 'duplicate', label: 'Duplicate', section: 1, icon: g(lucideCopy) },
  { id: 'rename', label: 'Rename', section: 1, icon: g(lucideTextCursorInput) },
  { id: 'group', label: 'Group', section: 1, icon: g(lucideGroup) },
  {
    id: 'ungroup',
    label: 'Ungroup',
    section: 1,
    icon: g(lucideFolderX),
    when: (l) => l.layerKind === 'group',
  },
  { id: 'merge-down', label: 'Merge Down', section: 2, icon: g(lucideMerge) },
  { id: 'merge-visible', label: 'Merge Visible', section: 2, icon: g(lucideLayers) },
  { id: 'flatten', label: 'Flatten Image', section: 2, icon: g(lucideImage) },
  {
    id: 'clip',
    label: 'Create Clipping Mask',
    section: 3,
    icon: g(lucideArrowDownToLine),
    when: (l) => !l.clip,
  },
  {
    id: 'clip',
    label: 'Release Clipping Mask',
    section: 3,
    icon: g(lucideArrowUpToLine),
    when: (l) => !!l.clip,
  },
  {
    id: 'add-mask',
    label: 'Add Mask',
    section: 3,
    icon: g(lucideSquareDashed),
    when: (l) => !l.mask,
  },
  {
    id: 'apply-mask',
    label: 'Apply Mask',
    section: 3,
    icon: g(lucideCheck),
    when: (l) => !!l.mask && l.layerKind === 'pixel',
  },
  {
    id: 'toggle-mask',
    label: 'Disable Mask',
    section: 3,
    icon: g(lucideEyeOff),
    when: (l) => !!l.mask && l.mask.enabled !== false,
  },
  {
    id: 'toggle-mask',
    label: 'Enable Mask',
    section: 3,
    icon: g(lucideEye),
    when: (l) => l.mask?.enabled === false,
  },
  {
    id: 'invert-mask',
    label: 'Invert Mask',
    section: 3,
    icon: g(lucideContrast),
    when: (l) => !!l.mask,
  },
  {
    id: 'select-mask',
    label: 'Select Mask',
    section: 3,
    icon: g(lucideLassoSelect),
    when: (l) => !!l.mask,
  },
  {
    id: 'delete-mask',
    label: 'Delete Mask',
    section: 3,
    icon: g(lucideCircleX),
    when: (l) => !!l.mask,
  },
  {
    id: 'rasterize',
    label: 'Rasterize',
    section: 4,
    icon: g(lucideGrid3x3),
    when: (l) => l.layerKind === 'text' || l.layerKind === 'fill',
  },
  {
    id: 'rasterize-effects',
    label: 'Rasterize Effects',
    section: 4,
    icon: g(lucideSparkles),
    when: (l) => l.layerKind === 'pixel' && !!l.effects && Object.keys(l.effects).length > 0,
  },
  {
    id: 'select-pixels',
    label: 'Select Pixels',
    section: 4,
    icon: g(lucideSquareDashedMousePointer),
    when: (l) => l.layerKind === 'pixel',
  },
  {
    id: 'remove-background',
    label: 'Remove Background',
    section: 4,
    icon: g(lucideWandSparkles),
    when: (l) => l.layerKind === 'pixel' && !l.mask,
  },
  {
    id: 'export-layer',
    label: 'Export Layer',
    section: 4,
    icon: g(lucideDownload),
    when: (l) => l.layerKind === 'pixel',
  },
  { id: 'delete-layer', label: 'Delete Layer', section: 5, icon: g(lucideTrash2) },
];

export function PhotoLayerRow({
  layer,
  depth,
  session,
  version,
  active,
  chosen,
  editable,
  others,
  onPress,
  onEye,
  onTarget,
  onRename,
  onFold,
  onAction,
  dropAt,
  drag,
}: {
  layer: PhotoLayer;
  depth: number;
  session: PhotoSession;
  // The session's change count: the thumbnails are made again after a change.
  version: number;
  active: boolean;
  chosen: boolean;
  editable: boolean;
  // Others on this layer now (their initials and colours), up to three.
  others: readonly { name: string; colour: string }[];
  onPress: (e: MouseEvent) => void;
  onEye: (alt: boolean) => void;
  onTarget: (target: 'layer' | 'mask') => void;
  onRename: (name: string) => void;
  onFold: () => void;
  onAction: (id: string) => void;
  // Where a row dragged over this one would land (useRowPointerDrag), and the row's own drag handlers.
  dropAt: RowDropAt | null;
  drag: {
    onPointerDown: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
    onPointerUp: () => void;
    onPointerCancel: () => void;
  } | null;
}) {
  'use no memo'; // It reads the mutable photo session as it renders (PhotoSession).
  const [renaming, setRenaming] = useState(false);
  const shake = useLockShake(layer.id);
  const menu = useRowMenu({ disabled: renaming || !editable });
  const shown = layer.visible !== false;
  // Remade after each change (the version names it).
  const thumb = useMemo(
    () => (layer.layerKind === 'pixel' ? layerThumbnail(session, layer.id, 'layer') : null),
    // oxlint-disable-next-line react/exhaustive-deps
    [session, layer, version],
  );
  const maskThumb = useMemo(
    () => (layer.mask ? layerThumbnail(session, layer.id, 'mask') : null),
    // oxlint-disable-next-line react/exhaustive-deps
    [session, layer, version],
  );
  const KindIcon = layer.layerKind === 'pixel' ? null : KIND_ICON[layer.layerKind];
  const target = active ? session.target : 'layer';
  const pct = Math.round((layer.opacity ?? 1) * 100);
  return (
    <div
      role="option"
      aria-selected={active || chosen}
      aria-label={`${layer.name}, ${KIND_NAME[layer.layerKind]}, ${shown ? 'visible' : 'hidden'}, ${pct}%`}
      tabIndex={active ? 0 : -1}
      data-layer-id={layer.id}
      {...(editable && !renaming && drag ? drag : {})}
      onClick={onPress}
      onContextMenu={menu.onContextMenu}
      className={`group/row relative my-0.5 flex h-12 cursor-pointer select-none items-center gap-2 rounded-lg pr-1 text-xs transition-colors ${
        active
          ? 'bg-brand-50 text-brand-900 ring-1 ring-brand-200 dark:bg-brand-500/15 dark:text-brand-100 dark:ring-brand-500/40'
          : chosen
            ? 'bg-slate-100 dark:bg-slate-800'
            : 'text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800/60'
      } ${dropAt === 'into' ? 'ring-2 ring-inset ring-brand-500' : ''} ${shown ? '' : 'opacity-60'}`}
      style={{ paddingLeft: 4 + depth * 16 }}
    >
      {active ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-2 left-0 w-[3px] rounded-full bg-brand-500"
        />
      ) : null}
      {dropAt === 'above' || dropAt === 'below' ? (
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-x-1 h-0.5 bg-brand-500 ${dropAt === 'above' ? 'top-0' : 'bottom-0'}`}
        />
      ) : null}
      <button
        type="button"
        aria-label={shown ? `Hide ${layer.name}` : `Show ${layer.name}`}
        aria-pressed={shown}
        disabled={!editable}
        onClick={(e) => {
          e.stopPropagation();
          onEye(e.altKey);
        }}
        className="flex h-7 w-6 shrink-0 items-center justify-center rounded text-slate-500 hover:text-slate-900 disabled:cursor-default dark:text-slate-400 dark:hover:text-white"
      >
        {shown ? <Eye /> : <EyeOff />}
      </button>
      {layer.layerKind === 'group' ? (
        <button
          type="button"
          aria-label={layer.collapsed ? `Open ${layer.name}` : `Fold ${layer.name}`}
          onClick={(e) => {
            e.stopPropagation();
            onFold();
          }}
          className="flex h-6 w-4 shrink-0 items-center justify-center text-slate-500"
        >
          {layer.collapsed ? <Closed /> : <Open />}
        </button>
      ) : null}
      {layer.clip ? (
        <span
          role="img"
          aria-label="Clipped to the layer below"
          className="shrink-0 text-[11px] text-slate-500 dark:text-slate-400"
        >
          ↳
        </span>
      ) : null}
      <button
        type="button"
        aria-label={`${layer.name} pixels`}
        onClick={(e) => {
          e.stopPropagation();
          onPress(e);
          onTarget('layer');
        }}
        className="shrink-0"
      >
        {KindIcon ? (
          <span className="flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
            <KindIcon />
          </span>
        ) : (
          <RasterThumb
            raster={thumb}
            size={40}
            ringed={active && target === 'layer' && !!layer.mask}
          />
        )}
      </button>
      {layer.mask ? (
        <button
          type="button"
          aria-label={`${layer.name} mask`}
          onClick={(e) => {
            e.stopPropagation();
            onPress(e);
            onTarget('mask');
          }}
          className={`shrink-0 ${layer.mask.enabled === false ? 'opacity-40' : ''}`}
        >
          <RasterThumb raster={maskThumb} size={40} ringed={active && target === 'mask'} />
        </button>
      ) : null}
      {renaming ? (
        <InlineRenameInput
          initial={layer.name}
          ariaLabel="Layer name"
          onCommit={(name) => {
            setRenaming(false);
            if (name.trim() && name !== layer.name) onRename(name.trim());
          }}
          onCancel={() => setRenaming(false)}
        />
      ) : (
        <span
          className="flex min-w-0 flex-1 flex-col"
          onDoubleClick={(e) => {
            if (!editable) return;
            e.stopPropagation();
            setRenaming(true);
          }}
        >
          <span className="truncate text-[12.5px] font-medium leading-tight">{layer.name}</span>
          <span className="truncate text-[11px] leading-tight text-slate-500 dark:text-slate-400">
            {describeLayer(layer, pct, shown)}
          </span>
        </span>
      )}
      {layer.locks && Object.keys(layer.locks).length ? (
        <span
          // A new key restarts the shake when a lock refuses a change again.
          key={`lock-${shake}`}
          role="img"
          aria-label="Locked"
          className={`shrink-0 text-slate-400 ${shake ? 'photo-lock-shake' : ''}`}
        >
          <Lock />
        </span>
      ) : null}
      {'effects' in layer && layer.effects && Object.keys(layer.effects).length ? (
        <span className="shrink-0 rounded bg-slate-200 px-1 text-[9px] font-semibold text-slate-600 dark:bg-slate-700 dark:text-slate-200">
          fx
        </span>
      ) : null}
      {others.length ? (
        <span className="flex shrink-0 -space-x-1">
          {others.slice(0, 3).map((o) => (
            <Tooltip key={o.name} label={o.name}>
              <span
                aria-label={o.name}
                role="img"
                className="flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white ring-1 ring-white dark:ring-slate-900"
                style={{ background: o.colour }}
              >
                <span className="text-optical-centre">{o.name.charAt(0).toUpperCase()}</span>
              </span>
            </Tooltip>
          ))}
          {others.length > 3 ? (
            <span className="pl-1.5 text-[9px] text-slate-500">+{others.length - 3}</span>
          ) : null}
        </span>
      ) : null}
      {editable ? (
        <EllipsisTriggerButton {...menu.triggerProps} label={`${layer.name} actions`} />
      ) : null}
      {menu.open ? (
        <PortalMenu
          anchor={menu.triggerRef.current}
          placement="below"
          // Beside the Photo panel, out of the way of the rows it acts on, as the canvas Layers menu opens.
          beside={
            menu.triggerRef.current?.closest<HTMLElement>('[data-tour-id="photo-panel"]') ?? null
          }
          onClose={menu.close}
        >
          <div className="flex items-center gap-2.5 px-3 pb-2 pt-1">
            {thumb ? (
              <RasterThumb raster={thumb} size={32} />
            ) : (
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-500 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700">
                {KindIcon ? <KindIcon /> : null}
              </span>
            )}
            <span className="flex min-w-0 flex-col">
              <span className="truncate text-[13px] font-semibold text-slate-800 dark:text-slate-100">
                {layer.name}
              </span>
              <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                {describeLayer(layer, pct, shown)}
              </span>
            </span>
          </div>
          <MenuGroupSeparator />
          {ROW_MENU.filter((m) => !m.when || m.when(layer)).map((m, i, all) => (
            <span key={`${m.id}-${m.label}`}>
              {i > 0 && all[i - 1]!.section !== m.section ? <MenuGroupSeparator /> : null}
              <MenuActionRow
                plain
                icon={<m.icon />}
                label={m.label}
                onClick={() => {
                  menu.close();
                  if (m.id === 'rename') setRenaming(true);
                  else onAction(m.id);
                }}
              />
            </span>
          ))}
        </PortalMenu>
      ) : null}
    </div>
  );
}
