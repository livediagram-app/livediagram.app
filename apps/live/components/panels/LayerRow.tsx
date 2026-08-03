import type { PointerEvent as ReactPointerEvent } from 'react';
import { isLayerLocked, isLayerVisible, type Layer } from '@livediagram/diagram';
import { InlineRenameInput } from '@/components/primitives/InlineRenameInput';
import { Tooltip } from '@/components/primitives/Tooltip';
import { onMouseHover } from '@/components/primitives/hover-preview';
import {
  EllipsisIcon,
  EyeIcon,
  EyeOffIcon,
  LockIcon,
} from '@/components/panels/layers-panel-icons';

// ONE ROW OF THE LAYERS PANEL: the eye, the thumbnail, the name (or its rename
// input), the count / Empty / lock chips, and the options button.
//
// Split out of LayersPanel because it is the part that grows. The panel around
// it is a header, a list and three footer buttons; the row is where every new
// per-layer affordance lands, and it had reached 124 lines inline — long enough
// that the list it sits in was no longer readable as a list.
//
// The four flags are derived here rather than passed: they are all pure
// functions of the layer and the panel's active id, so deriving them at the top
// of the row keeps the caller's map body to the row itself.

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
  enterRowPreview,
  leaveRowPreview,
  rowPointerDown,
  rowPointerMove,
  rowPointerUp,
  openRowMenu,
  onSelectLayer,
  onToggleVisibility,
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
  enterRowPreview: (id: string) => void;
  leaveRowPreview: () => void;
  rowPointerDown: (id: string) => (e: ReactPointerEvent<HTMLElement>) => void;
  rowPointerMove: (e: ReactPointerEvent<HTMLElement>) => void;
  rowPointerUp: (e: ReactPointerEvent<HTMLElement>) => void;
  openRowMenu: (id: string, anchor: HTMLElement) => void;
  onSelectLayer: (id: string) => void;
  onToggleVisibility: (id: string) => void;
}) {
  const active = layer.id === activeLayerId;
  const visible = isLayerVisible(layer);
  const locked = isLayerLocked(layer);
  const empty = (counts.get(layer.id) ?? 0) === 0;
  return (
    <li
      key={layer.id}
      data-layer-id={layer.id}
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
        'group flex cursor-pointer items-center gap-1.5 rounded-lg px-1.5 py-1.5 transition ' +
        (active
          ? 'bg-brand-50 ring-1 ring-inset ring-brand-200 dark:bg-brand-500/10 dark:ring-brand-500/30 '
          : 'hover:bg-slate-100 dark:hover:bg-slate-800 ') +
        (dropTargetId === layer.id ? 'outline outline-2 outline-brand-400 ' : '') +
        (dragId === layer.id ? 'opacity-50 ' : '')
      }
      onClick={() => onSelectLayer(layer.id)}
      onDoubleClick={() => setRenamingId(layer.id)}
    >
      <Tooltip
        title={visible ? 'Hide layer' : 'Show layer'}
        description={
          visible ? 'Hide every element on this layer.' : 'Show this layer’s elements again.'
        }
      >
        <button
          type="button"
          aria-label={visible ? `Hide ${layer.name}` : `Show ${layer.name}`}
          aria-pressed={!visible}
          onClick={(e) => {
            e.stopPropagation();
            onToggleVisibility(layer.id);
          }}
          className={
            'flex h-6 w-6 shrink-0 items-center justify-center rounded transition hover:bg-slate-200 dark:hover:bg-slate-700 ' +
            (visible ? 'text-slate-500 dark:text-slate-400' : 'text-slate-300 dark:text-slate-600')
          }
        >
          {visible ? <EyeIcon /> : <EyeOffIcon />}
        </button>
      </Tooltip>
      {showPreview ? (
        <span className="flex h-11 w-16 shrink-0 items-center justify-center overflow-hidden rounded border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
          {thumbViewBox && thumbMarkup.get(layer.id) ? (
            <svg
              viewBox={thumbViewBox}
              preserveAspectRatio="xMidYMid meet"
              className="h-full w-full"
              aria-hidden
              dangerouslySetInnerHTML={{ __html: thumbMarkup.get(layer.id)! }}
            />
          ) : null}
        </span>
      ) : null}
      {renamingId === layer.id ? (
        <InlineRenameInput
          initial={layer.name}
          onCommit={commitRename}
          onCancel={() => setRenamingId(null)}
          ariaLabel="Layer name"
          className="w-full min-w-0 flex-1 rounded border border-brand-300 bg-white px-1 py-0.5 text-xs text-slate-800 dark:border-brand-500/50 dark:bg-slate-900 dark:text-slate-100"
        />
      ) : (
        <span
          className={
            'min-w-0 flex-1 truncate text-xs ' +
            (active
              ? 'font-semibold text-brand-700 dark:text-brand-300'
              : 'font-medium text-slate-700 dark:text-slate-200')
          }
        >
          {layer.name}
        </span>
      )}
      {/* How much is on this layer. Same quiet chip as the Empty
        tag below, so a column of rows reads as one thing. */}
      {showCount && !empty && renamingId !== layer.id ? (
        <span className="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[9px] font-semibold tabular-nums text-slate-400 dark:bg-slate-800 dark:text-slate-500">
          {counts.get(layer.id) ?? 0}
        </span>
      ) : null}
      {/* Empty layers wear a quiet tag so they're easy to spot
        (and prune) at a glance — the blank preview alone
        doesn't read as "nothing here". */}
      {empty && renamingId !== layer.id ? (
        <span className="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400 dark:bg-slate-800 dark:text-slate-500">
          Empty
        </span>
      ) : null}
      {locked ? (
        <span
          aria-label={`${layer.name} is locked`}
          className="shrink-0 text-brand-600 dark:text-brand-400"
        >
          <LockIcon />
        </span>
      ) : null}
      <Tooltip title="Layer options" description="Rename, restack, lock, merge, and more.">
        <button
          type="button"
          aria-label={`${layer.name} options`}
          onClick={(e) => {
            e.stopPropagation();
            openRowMenu(layer.id, e.currentTarget);
          }}
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-slate-400 transition hover:bg-slate-200 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-300"
        >
          <EllipsisIcon />
        </button>
      </Tooltip>
    </li>
  );
}
