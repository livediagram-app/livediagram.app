'use client';

// A tool opened inside the footer's Tools (liveworkspace/docs/specs/004-index/footer-tools-menu.md "Opening a tool
// inside Tools"; blueprint FM6): Tools' illustrated band heads it, naming the tool, its title mark a back button to the
// list (as Tab Style's header is, Work Tracker 1476), then the tool. The band's corner close is the popover's only
// close. A tool drawn by a dialog renders into the slot here (dialog-slot.ts, @liveworkspace/ui); until it arrives
// (its code loading) skeleton rows hold its place. Focus moves in as it opens: to the band's back button, unless the
// tool has already taken it (a confirm's button).
import { useEffect, useRef, type ReactNode } from 'react';
import { HeroDialogHeader } from '@liveworkspace/ui/dialog-hero';
import { toolsHeroArt } from '@liveworkspace/ui/dialog-hero-art/tools';
import { ToolSkeleton } from '@liveworkspace/ui/tool-explainer';

export const TOOLS_TITLE = 'Tools';
export const TOOLS_LINE = 'Powerful tools to enhance your experience.';
/** The band's back button's name and tooltip: where it goes. */
export const TOOLS_BACK_LABEL = `Back to ${TOOLS_TITLE}`;

/** Tools' band over every view (FM6): "Tools" and its line on the list; on a tool, the tool's name and its row's line,
 *  the title mark's place holding the back button. The art stays Tools' pegboard, as Tab Style keeps its own. */
export function ToolsHeader({
  titleId,
  tool,
  onBack,
  sheet,
}: {
  titleId: string;
  /** The open tool, or null on the list. */
  tool: { label: string; description: string } | null;
  onBack: () => void;
  sheet: boolean;
}) {
  return (
    <HeroDialogHeader
      art={toolsHeroArt}
      titleId={titleId}
      title={tool ? tool.label : TOOLS_TITLE}
      subtitle={tool ? tool.description : TOOLS_LINE}
      {...(tool ? { onBack, backLabel: TOOLS_BACK_LABEL } : {})}
      // The title and its line stop short of the art in the bottom right (96px, 12px in) and the close above it.
      className="max-sm:pr-16 sm:pr-[7.5rem]"
      // A phone's drawer: the band runs up under its grab handle.
      underHandle={sheet}
    />
  );
}

/** Tools' height in every app, list and tool alike: what liveplanner's list (the longest) stretches to, the 500 px
 *  floor plus three more 95 px rows. Never past the screen. */
export const TOOLS_HEIGHT_PX = 785;

export function ToolsView({
  id,
  label,
  tall,
  sheet,
  slotRef,
  waiting,
  floorPx,
  children,
}: {
  id: string;
  label: string;
  /** A whole screen of a tool (Automations): a fixed height, so its own lists lay out and scroll as they did. */
  tall: boolean;
  sheet: boolean;
  /** Where a tool's dialog renders, for a tool that opens one. */
  slotRef?: (node: HTMLDivElement | null) => void;
  /** The tool's dialog has not arrived yet. */
  waiting: boolean;
  /** The Tools list's height as it last showed: every tool takes exactly this height and scrolls inside it, its footer
   *  pinned (owner, 2026-11-17). */
  floorPx?: number | null;
  children?: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // After the tool's own first render and its effects, so a control it focused keeps the focus.
    const frame = requestAnimationFrame(() => {
      const at = root.current;
      if (!at || at.contains(document.activeElement)) return;
      at.closest('[data-tools-popover]')
        ?.querySelector<HTMLElement>('[data-dialog-hero-back]')
        ?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <div
      ref={root}
      data-tools-view={id}
      // Exactly the list's height (owner, 2026-11-17: every tool the same height as Tools, scrolling inside it with its
      // footer pinned), and never under the room under the 100 px band (Tools' 500 px floor, less the band and the
      // height box's 4 px pad): a short list measured under that floor left the tool a strip of it, its own scroller
      // squeezed to nothing (History's timeline) over a blank band.
      className="flex min-h-[calc(min(500px,100dvh-2rem)-104px)] flex-1 flex-col"
      // A phone's drawer: at least the list's height, and as tall as the drawer is dragged.
      // Off a phone the tool fills Tools' one height (TOOLS_HEIGHT_PX, less the 100 px band and the 4 px pad), its
      // footer at the bottom (owner 2026-11-21: History's Take Snapshot floated mid-panel over a blank band).
      style={{
        ...(floorPx ? (sheet ? { minHeight: floorPx } : { height: floorPx }) : {}),
        ...(sheet ? {} : { minHeight: `calc(min(${TOOLS_HEIGHT_PX}px, 100dvh - 2rem) - 104px)` }),
      }}
    >
      {/* No breadcrumb row (the band is the way back, Work Tracker 1476): a short gap keeps the tool off its hairline. */}
      <div
        className={`flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pt-2 ${
          tall && !floorPx
            ? sheet
              ? 'h-[calc(75dvh-100px)]'
              : 'h-[min(44rem,calc(100dvh-14rem))]'
            : ''
        }`}
      >
        {waiting ? (
          // In a tool's empty shape (owner, 2026-11-17: tools open empty; no judder as the real one arrives).
          <ToolSkeleton label={`Loading ${label}`} />
        ) : null}
        {slotRef ? (
          <div
            ref={slotRef}
            data-tools-slot=""
            className={waiting ? 'hidden' : 'flex min-h-0 flex-1 flex-col'}
          />
        ) : (
          children
        )}
      </div>
    </div>
  );
}
