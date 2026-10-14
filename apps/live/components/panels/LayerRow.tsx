import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { isLayerLocked, isLayerVisible, layerOpacityOf, type Layer } from '@livediagram/document';
import { InlineRenameInput } from '@/components/primitives/InlineRenameInput';
import { onMouseHover } from '@/components/primitives/hover-preview';
import {
  EllipsisIcon,
  GripIcon,
  LockIcon,
  RowEyeIcon,
  RowEyeOffIcon,
  UnlockIcon,
} from '@/components/panels/layers-panel-icons';
import { HoverCard } from '@livediagram/ui';

// ONE ROW OF THE LAYERS PANEL (docs/specs/006-document/layers.md "The Layers panel"): grip ·
// preview · name over a meta line · lock · eye · options.
//
// Split out of LayersPanel because it is the part that grows: the panel around it is a header, a
// list and a footer; the row is where every per-layer affordance lands.
//
// The flags are derived here rather than passed: they are all pure functions of the layer and the
// panel's active id, so deriving them at the top of the row keeps the caller's map body short.

// Controls that only matter on the row you are looking at: shown on hover, on keyboard focus, on
// the active row, and always where there is no hover (touch).
const REVEAL =
  'opacity-0 group-hover:opacity-100 focus-visible:opacity-100 [@media(hover:none)]:opacity-100';

// The meta line under a layer's name: how much is on it, then any state that changes how it
// renders or behaves. Exported for its test.
export function layerMetaLine(layer: Layer, count: number, showCount: boolean): string {
  const parts: string[] = [];
  if (count === 0) parts.push('Empty');
  else if (showCount) parts.push(`${count} ${count === 1 ? 'element' : 'elements'}`);
  const opacity = layerOpacityOf(layer);
  if (opacity < 1) parts.push(`${Math.round(opacity * 100)}% opacity`);
  if (isLayerLocked(layer)) parts.push('Locked');
  if (!isLayerVisible(layer)) parts.push('Hidden');
  return parts.join(' · ');
}

export function LayerRow({
  layer,
  activeLayerId,
  counts,
  showPreview,
  showCount,
  thumbViewBox,
  thumbMarkup,
  renamingId,
  setRenamingId,
  commitRename,
  dragId,
  dropTargetId,
  dropEdge,
  enterRowPreview,
  leaveRowPreview,
  rowPointerDown,
  rowPointerMove,
  rowPointerUp,
  openRowMenu,
  onSelectLayer,
  onToggleVisibility,
  onToggleLock,
}: {
  layer: Layer;
  activeLayerId: string | null;
  counts: Map<string, number>;
  showPreview: boolean;
  showCount: boolean;
  thumbViewBox: string | null;
  thumbMarkup: Map<string, string>;
  renamingId: string | null;
  setRenamingId: (id: string | null) => void;
  commitRename: (name: string) => void;
  dragId: string | null;
  dropTargetId: string | null;
  dropEdge: 'top' | 'bottom' | null;
  enterRowPreview: (id: string) => void;
  leaveRowPreview: () => void;
  rowPointerDown: (id: string) => (e: ReactPointerEvent<HTMLElement>) => void;
  rowPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  rowPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
  openRowMenu: (id: string, anchor: HTMLElement) => void;
  onSelectLayer: (id: string) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
}) {
  const active = layer.id === activeLayerId;
  const visible = isLayerVisible(layer);
  const locked = isLayerLocked(layer);
  const count = counts.get(layer.id) ?? 0;
  const renaming = renamingId === layer.id;
  const dropHere = dropTargetId === layer.id ? dropEdge : null;
  const markup = thumbMarkup.get(layer.id);
  return (
    <li
      data-layer-id={layer.id}
      aria-current={active || undefined}
      onPointerEnter={onMouseHover(() => enterRowPreview(layer.id))}
      onPointerLeave={onMouseHover(leaveRowPreview)}
      onPointerDown={rowPointerDown(layer.id)}
      onPointerMove={rowPointerMove}
      onPointerUp={rowPointerUp}
      onPointerCancel={rowPointerUp}
      onContextMenu={(e) => {
        e.preventDefault();
        e.stopPropagation();
        openRowMenu(layer.id, e.currentTarget);
      }}
      className={
        'group relative flex min-h-[60px] cursor-pointer select-none items-center gap-2 rounded-xl py-1.5 pl-4 pr-1.5 transition ' +
        (active
          ? 'bg-brand-50 ring-1 ring-inset ring-brand-200 dark:bg-brand-500/10 dark:ring-brand-500/30 '
          : 'hover:bg-slate-100 dark:hover:bg-slate-800/70 ') +
        (dragId === layer.id ? 'opacity-40 ' : '')
      }
      onClick={() => onSelectLayer(layer.id)}
      onDoubleClick={() => setRenamingId(layer.id)}
    >
      {dropHere ? (
        <span
          aria-hidden
          data-testid="layer-drop-line"
          className={
            'pointer-events-none absolute inset-x-2 h-0.5 rounded-full bg-brand-500 dark:bg-brand-400 ' +
            (dropHere === 'top' ? '-top-[3px]' : '-bottom-[3px]')
          }
        />
      ) : null}
      {/* In the row's leading padding, so it costs the name no width. */}
      <span
        aria-hidden
        className={`absolute left-0.5 top-1/2 flex w-3.5 -translate-y-1/2 cursor-grab justify-center text-slate-400 dark:text-slate-400 ${active ? '' : REVEAL}`}
      >
        <GripIcon />
      </span>
      {showPreview ? (
        <span
          className={
            'flex h-12 w-[72px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white transition dark:bg-slate-950 ' +
            (count === 0
              ? 'border border-dashed border-slate-300 dark:border-slate-600 '
              : 'border border-slate-200 shadow-sm dark:border-slate-700 ') +
            (visible ? '' : 'opacity-40')
          }
        >
          {thumbViewBox && markup ? (
            <svg
              viewBox={thumbViewBox}
              preserveAspectRatio="xMidYMid meet"
              className="h-full w-full p-0.5"
              aria-hidden
              dangerouslySetInnerHTML={{ __html: markup }}
            />
          ) : null}
        </span>
      ) : null}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5 pl-0.5">
        {renaming ? (
          <InlineRenameInput
            initial={layer.name}
            onCommit={commitRename}
            onCancel={() => setRenamingId(null)}
            ariaLabel="Layer name"
            className="w-full min-w-0 rounded-md border border-brand-300 bg-white px-1.5 py-0.5 text-[13px] text-slate-800 dark:border-brand-500/50 dark:bg-slate-900 dark:text-slate-100"
          />
        ) : (
          <span
            className={
              'truncate text-[13px] ' +
              (active
                ? 'font-semibold text-brand-700 dark:text-brand-200'
                : 'font-medium text-slate-800 dark:text-slate-100') +
              (visible ? '' : ' opacity-50')
            }
          >
            {layer.name}
          </span>
        )}
        <span className="truncate text-[11px] text-slate-500 dark:text-slate-400">
          {layerMetaLine(layer, count, showCount)}
        </span>
      </span>
      <RowToggle
        label={locked ? `Unlock ${layer.name}` : `Lock ${layer.name}`}
        title={locked ? 'Unlock Layer' : 'Lock Layer'}
        description={
          locked
            ? 'Let this layer’s elements be selected and edited again.'
            : 'Freeze this layer: its elements stay visible but can’t be selected.'
        }
        pressed={locked}
        className={
          locked
            ? 'text-brand-700 dark:text-brand-300'
            : `text-slate-400 dark:text-slate-400 ${active ? '' : REVEAL}`
        }
        onClick={() => onToggleLock(layer.id)}
      >
        {locked ? <LockIcon /> : <UnlockIcon />}
      </RowToggle>
      <RowToggle
        label={visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
        title={visible ? 'Hide Layer' : 'Show Layer'}
        description={
          visible ? 'Hide every element on this layer.' : 'Show this layer’s elements again.'
        }
        pressed={!visible}
        className={
          visible ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400 dark:text-slate-400'
        }
        onClick={() => onToggleVisibility(layer.id)}
      >
        {visible ? <RowEyeIcon /> : <RowEyeOffIcon />}
      </RowToggle>
      <HoverCard title="Layer Options" description="Opacity, restack, merge, rename and more.">
        <button
          type="button"
          aria-label={`${layer.name} options`}
          aria-haspopup="menu"
          onClick={(e) => {
            e.stopPropagation();
            openRowMenu(layer.id, e.currentTarget);
          }}
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-200 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-200 ${active ? '' : REVEAL}`}
        >
          <EllipsisIcon />
        </button>
      </HoverCard>
    </li>
  );
}

// A 32px icon toggle on the row: stops the click from also activating the row.
function RowToggle({
  label,
  title,
  description,
  pressed,
  className,
  onClick,
  children,
}: {
  label: string;
  title: string;
  description: string;
  pressed: boolean;
  className: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <HoverCard title={title} description={description}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={pressed}
        onClick={(e) => {
          e.stopPropagation();
          onClick();
        }}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700 dark:hover:text-slate-200 ${className}`}
      >
        {children}
      </button>
    </HoverCard>
  );
}
