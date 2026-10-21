'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import type { Tab } from '@livediagram/document';
import { SideBySideIcon } from '@livediagram/ui';
import {
  SPLIT_TAB_BAR_CLEARANCE_PX,
  approachProgress,
  dropZoneWidth,
  inDropZone,
} from '@/lib/split-view';
import { setDraggedTab, useDraggedTab } from '@/lib/tab-drag-store';
import type { SplitView } from '@/hooks/ui/useSplitView';

const SplitTabPreview = dynamic(() => import('./SplitStaticPane').then((m) => m.SplitTabPreview), {
  ssr: false,
});

// The target a dragged tab pill finds on the right of the screen (docs/specs/007-editor/split-view.md
// "Opening"). While a tab is in flight a glowing rail wakes on the right edge and brightens as the
// pointer heads for it; inside the zone a ghost of the pane slides in at the size it will open,
// showing the tab's own drawing; letting go there opens it. With a split already open the zone is
// the right pane itself, and dropping replaces the tab beside you.
export function SplitDropZone({
  split,
  tabs,
  loadedTabIds,
}: {
  split: SplitView;
  tabs: readonly Tab[];
  loadedTabIds: ReadonlySet<string>;
}) {
  const draggedId = useDraggedTab();
  const dragged = draggedId ? tabs.find((t) => t.id === draggedId) : undefined;
  const offered = !!dragged && split.available && split.canOpen(dragged.id);
  const [point, setPoint] = useState<{ x: number; y: number } | null>(null);
  const frame = useRef(0);

  // The ghost previews the dragged tab's drawing: fetch it now if nobody has opened it yet.
  const { prefetch } = split;
  useEffect(() => {
    if (offered && draggedId) prefetch(draggedId);
  }, [offered, draggedId, prefetch]);

  // Track the pointer through the browser's drag: dragover is the only event that carries it, and
  // it fires on whatever is under the pointer, so listen on the document. One state write a frame.
  useEffect(() => {
    if (!offered) return;
    const onDragOver = (e: DragEvent) => {
      const next = { x: e.clientX, y: e.clientY };
      cancelAnimationFrame(frame.current);
      frame.current = requestAnimationFrame(() => setPoint(next));
    };
    document.addEventListener('dragover', onDragOver);
    return () => {
      document.removeEventListener('dragover', onDragOver);
      cancelAnimationFrame(frame.current);
      setPoint(null);
    };
  }, [offered]);

  if (!offered || !dragged) return null;

  const viewport = { width: window.innerWidth, height: window.innerHeight };
  const openWidth = split.pair ? split.rightWidth : null;
  const armed = point !== null && inDropZone(point, viewport, openWidth);
  const progress = point ? approachProgress(point.x, viewport.width, openWidth) : 0;
  // The ghost is the pane as it will open: the width the person last chose.
  const ghostWidth = split.rightWidth;
  const zoneWidth = dropZoneWidth(viewport.width, openWidth);

  return (
    <div
      className="pointer-events-none fixed inset-0 z-[var(--z-overlay)]"
      data-testid="split-drop-zone"
    >
      {/* The catch area: takes the drop, and nothing else. */}
      <div
        className="pointer-events-auto absolute right-0 top-0"
        style={{ width: zoneWidth, bottom: SPLIT_TAB_BAR_CLEARANCE_PX }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'move';
        }}
        onDrop={(e) => {
          e.preventDefault();
          setDraggedTab(null);
          split.open(dragged.id, 'Drag');
        }}
      />
      {/* The edge rail: always there while a tab is in flight, brighter the nearer the pointer. */}
      <div
        aria-hidden
        className="absolute right-0 top-0 w-1.5 rounded-l-full bg-gradient-to-b from-brand-400 via-brand-500 to-brand-400 transition-[opacity,width] duration-150"
        style={{
          bottom: SPLIT_TAB_BAR_CLEARANCE_PX,
          opacity: armed ? 0 : 0.35 + progress * 0.65,
          boxShadow: `0 0 ${12 + progress * 28}px ${2 + progress * 6}px color-mix(in srgb, var(--color-brand-500) ${Math.round(25 + progress * 35)}%, transparent)`,
        }}
      />
      {!armed ? (
        <div
          aria-hidden
          className="split-hint-enter absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-2 rounded-full border border-brand-200 bg-white/95 py-1.5 pl-2.5 pr-3 text-xs font-semibold text-brand-700 shadow-lg backdrop-blur transition-opacity duration-150 dark:border-brand-500/40 dark:bg-slate-900/95 dark:text-brand-200"
          style={{ opacity: 0.55 + progress * 0.45 }}
        >
          <SideBySideIcon size={14} />
          {openWidth ? 'Drop to Show Here' : 'Drop to Open Side by Side'}
        </div>
      ) : (
        <div
          role="status"
          className="split-ghost-enter absolute right-0 top-0 flex flex-col overflow-hidden rounded-l-2xl border-2 border-r-0 border-brand-500 bg-brand-50/85 shadow-2xl backdrop-blur-sm dark:bg-slate-900/85"
          style={{ width: ghostWidth, bottom: SPLIT_TAB_BAR_CLEARANCE_PX }}
        >
          <div className="flex h-14 shrink-0 items-center gap-2 border-b border-brand-200 px-3 text-sm font-semibold text-brand-800 dark:border-brand-500/30 dark:text-brand-100">
            <SideBySideIcon size={16} />
            <span className="truncate">
              {openWidth ? `Show ${dragged.name} Here` : `Open ${dragged.name} Side by Side`}
            </span>
          </div>
          <div className="relative min-h-0 flex-1 opacity-90">
            <SplitTabPreview tab={dragged} loaded={loadedTabIds.has(dragged.id)} />
            <div className="absolute inset-0 flex items-end justify-center pb-6">
              <span className="rounded-full bg-brand-700 px-3 py-1 text-xs font-semibold text-white shadow-lg dark:bg-brand-600">
                Release to Open
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
