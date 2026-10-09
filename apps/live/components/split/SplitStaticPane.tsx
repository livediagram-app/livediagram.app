'use client';

import { useEffect, useMemo, useRef, type CSSProperties, type Ref } from 'react';
import type { Tab } from '@livediagram/document';
import { isTextEditFocused } from '@livediagram/ui';
import { TabModeIcon } from '@/components/chrome/editor-mode/TabModeIcon';
import { useEditorContext } from '@/app/document/[id]/EditorContext';
import { tabBackgroundStyle } from '@/lib/canvas-backgrounds';
import { resolveEditorMode } from '@/lib/editor-mode-store';
import { anyModalOpen } from '@/lib/modal-guard';
import { SPLIT_HOVER_FOCUS_MS } from '@/lib/split-view';
import type { CanvasAnchor } from '@/lib/split-pane-view';
import { legibleTabAccent } from '@/lib/tab-accent';
import { resolveViewBackdrop } from '@/lib/view-backdrop';
import { readDrawPattern } from '@/lib/whiteboard-dock-prefs';
import { useAppearance } from '@/hooks/ui/useAppearance';
import { TabSvgViewport, type TabSvgViewportHandle } from './TabSvgViewport';
import { useTabSvg } from './useTabSvg';

// The pane without the editor (docs/specs/007-editor/split-view.md "The other pane"): the other tab
// of the split, live, on its own paper. It looks like the canvas it is: the editor's toolbars and
// panels sit in the other pane, and come here when the person clicks in, or rests the pointer here
// for a moment. A small chip names the tab. Its Fit and Close live on the seam (SplitDivider), which
// belongs to neither pane, so reaching for them never moves the editor. Loaded on demand, so a
// document never split pays nothing for it.
export function SplitStaticPane({
  tab,
  loaded,
  failed = false,
  initialAnchor,
  handleRef,
  fitNonce,
  onFocus,
}: {
  tab: Tab;
  // False while the tab's content is still on its way (a tab nobody had opened yet).
  loaded: boolean;
  // The tab's content could not be fetched; clicking in loads it as the editor does, with its Retry.
  failed?: boolean;
  // The view the editor had on this tab as it left, so the drawing holds still.
  initialAnchor: CanvasAnchor | null;
  handleRef: Ref<TabSvgViewportHandle>;
  // Bumped by the seam's Fit to Pane button.
  fitNonce: number;
  onFocus: (via: 'Click' | 'Hover') => void;
}) {
  const { editingId, userPreferences } = useEditorContext();
  const { appearance } = useAppearance();
  const isDark = appearance === 'dark';
  const svg = useTabSvg(loaded ? tab : undefined);
  const empty = loaded && tab.elements.length === 0;

  // The paper and pattern the editor would paint for this tab, in its mode.
  const backdrop = useMemo(() => {
    const { mode } = resolveEditorMode({ tab, canEdit: true });
    return resolveViewBackdrop(
      tab,
      { mode, drawPattern: readDrawPattern(userPreferences) },
      appearance,
    );
  }, [tab, userPreferences, appearance]);
  const paint = (origin: { x: number; y: number }, k: number): CSSProperties =>
    tabBackgroundStyle(
      backdrop.backgroundPattern ?? 'grid',
      origin,
      backdrop.backgroundColor,
      backdrop.patternColor,
      backdrop.backgroundOpacity ?? 1,
      (tab.backgroundPatternScale ?? 1) * k,
    );

  // Resting here hands the editor over; passing through on the way somewhere doesn't. Never while
  // a button is held (a drag crossing the seam), a dialog is up, or text is being typed.
  const dwell = useRef<number | null>(null);
  const cancelDwell = () => {
    if (dwell.current !== null) window.clearTimeout(dwell.current);
    dwell.current = null;
  };
  useEffect(() => cancelDwell, []);
  const armDwell = (buttons: number) => {
    cancelDwell();
    // Typing in a field (a panel, the Explorer filter, a comment) keeps the editor where it is.
    if (buttons !== 0 || editingId !== null || anyModalOpen() || isTextEditFocused()) return;
    dwell.current = window.setTimeout(() => {
      dwell.current = null;
      if (!anyModalOpen() && !isTextEditFocused()) onFocus('Hover');
    }, SPLIT_HOVER_FOCUS_MS);
  };

  return (
    <section
      aria-label={`${tab.name}, side by side. Click to edit.`}
      className="relative h-full min-w-0 cursor-pointer"
      style={paint({ x: 0, y: 0 }, 1)}
      onPointerEnter={(e) => armDwell(e.buttons)}
      onPointerMove={(e) => {
        // A button held on the way in (a drag crossing the seam) and released here still counts.
        if (dwell.current === null) armDwell(e.buttons);
      }}
      onPointerLeave={cancelDwell}
      onPointerDown={(e) => {
        cancelDwell();
        e.preventDefault();
        onFocus('Click');
      }}
    >
      {!loaded && failed ? (
        <PaneMessage>{`Couldn't load ${tab.name}. Click to try again.`}</PaneMessage>
      ) : !loaded || !svg ? (
        <PaneMessage busy>{`Loading ${tab.name}…`}</PaneMessage>
      ) : empty ? (
        <PaneMessage>Nothing on this tab yet. Click to start on it.</PaneMessage>
      ) : (
        <TabSvgViewport
          svg={svg}
          fitNonce={fitNonce}
          initialAnchor={initialAnchor}
          backdrop={paint}
          handleRef={handleRef}
        />
      )}
      {/* The tab's name, where the editor's Explorer would sit, so the pane says what it shows. */}
      <div className="pointer-events-none absolute left-4 top-4 flex max-w-[calc(100%-8rem)] items-center gap-2 rounded-full border border-slate-200/80 bg-white/90 py-1.5 pl-2.5 pr-3 shadow-sm backdrop-blur dark:border-slate-700/80 dark:bg-slate-900/90">
        <TabModeIcon tab={tab} style={{ color: legibleTabAccent(tab, isDark) }} />
        <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
          {tab.name}
        </span>
        <span className="shrink-0 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          Live
        </span>
      </div>
    </section>
  );
}

// The drawing alone, fitted and still: what the drop zone shows of the tab you are dragging, so
// the target previews exactly what will open there.
export function SplitTabPreview({ tab, loaded }: { tab: Tab; loaded: boolean }) {
  const svg = useTabSvg(loaded ? tab : undefined);
  if (!svg || tab.elements.length === 0) return null;
  return <TabSvgViewport svg={svg} fitNonce={0} />;
}

function PaneMessage({ children, busy = false }: { children: string; busy?: boolean }) {
  return (
    <div className="flex h-full w-full items-center justify-center p-6">
      <p
        role={busy ? 'status' : undefined}
        className="max-w-xs rounded-full bg-white/80 px-3 py-1 text-center text-sm text-slate-500 dark:bg-slate-900/80 dark:text-slate-400"
      >
        {children}
      </p>
    </div>
  );
}
