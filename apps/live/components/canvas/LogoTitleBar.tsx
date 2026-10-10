'use client';

// A logo page's own title-bar controls (docs/specs/007-editor/logo-pages.md "Beside the cog"),
// before its cog, each the cog's size with a tooltip: Tidy Up (while the selection holds a
// hand-drawn line; the mind map's tidy wand), Mirror (pressed while on; opens its popover,
// LogoMirrorPopover) and Guides (pressed while the page shows them; opens LogoGuidesPopover).
import { useContext, type ReactNode } from 'react';
import { lucideGrid3x3, lucideWandSparkles } from '@livediagram/icons/lucide';
import { lucideGlyph, Tooltip } from '@livediagram/ui';
import { EditorContext } from '@/app/document/[id]/EditorContext';
import { useHasSelectionStore, useSelectionOf } from '@/hooks/canvas/useSelectionStore';
import type { LogoToolsView } from '@/hooks/editor/useLogoTools';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { MirrorAxisGlyph } from './logo-glyphs';
import { LogoMirrorButton } from './LogoMirrorPopover';
import { LogoGuidesButton } from './LogoGuidesPopover';

const GuidesIcon = lucideGlyph(lucideGrid3x3, 14);
const TidyUpIcon = lucideGlyph(lucideWandSparkles, 14);

// The title-bar room each control takes (24 px and the gap), so the page's label truncates first;
// each named beside its icon takes this much on a desktop.
const BUTTON_ROOM = 28;
const LABELLED_ROOM = 72;

/** The room the controls take: Tidy Up while it shows, then Mirror and Guides, named on a desktop. */
export function logoTitleBarRoom(tidyUp: boolean, labelled: boolean): number {
  const each = labelled ? LABELLED_ROOM : BUTTON_ROOM;
  return (tidyUp ? each : 0) + 2 * each;
}

// The controls' look: the cog's size, named beside the icon when `labelled`, tinted while on.
function titleButtonClass(on: boolean | undefined, labelled: boolean): string {
  return `flex h-6 items-center justify-center rounded-md transition ${
    labelled ? 'gap-1 px-1.5 text-[11px] font-medium' : 'w-6'
  } focus-visible:outline-2 focus-visible:outline-brand-600 ${
    on
      ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
      : 'text-slate-500 hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
  }`;
}

function TitleButton({
  label,
  text,
  on,
  onClick,
  children,
}: {
  label: string;
  // A name shown beside the icon (Mirror and Guides, on a desktop).
  text?: string;
  on?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Tooltip label={label}>
      <button
        type="button"
        aria-label={label}
        {...(on === undefined ? {} : { 'aria-pressed': on })}
        onClick={onClick}
        className={titleButtonClass(on, !!text)}
      >
        {children}
        {text ? <span aria-hidden>{text}</span> : null}
      </button>
    </Tooltip>
  );
}

// Tidy Up, shown while the selection holds a hand-drawn line. Re-rendered as the selection changes.
function TidyUpButton({
  canTidyUp,
  tidyUp,
  labelled,
}: {
  canTidyUp: () => boolean;
  tidyUp: () => void;
  labelled: boolean;
}) {
  useSelectionOf((s) => s.selectedId);
  useSelectionOf((s) => s.multiSelectedIds);
  return canTidyUp() ? (
    <TitleButton
      label="Tidy Up: straighten the selected drawing"
      text={labelled ? 'Tidy Up' : undefined}
      onClick={tidyUp}
    >
      <TidyUpIcon />
    </TitleButton>
  ) : null;
}

export function LogoTitleBar({ pageId, tools }: { pageId: string; tools: LogoToolsView }) {
  // Mirror and Guides name themselves on a desktop; a phone keeps them icon-only.
  const labelled = !useIsMobileViewport();
  const editor = useContext(EditorContext);
  const selection = useHasSelectionStore();
  return (
    <div
      className="pointer-events-auto flex items-center gap-1"
      // A press here is the controls', never the canvas's (no marquee, no deselect, no draw).
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      {editor && selection ? (
        <TidyUpButton
          canTidyUp={editor.canTidyUp}
          tidyUp={editor.tidyUpSelected}
          labelled={labelled}
        />
      ) : null}
      {/* Mirror opens its popover: on or off, axis, copies, merge. */}
      <LogoMirrorButton
        pageId={pageId}
        tools={tools}
        labelled={labelled}
        className={titleButtonClass}
      >
        <MirrorAxisGlyph axis={tools.mirrorSettings(pageId).axis} size={14} />
      </LogoMirrorButton>
      {/* Guides opens its popover: Show Guides for this page, which guides, how strong. */}
      <LogoGuidesButton
        pageId={pageId}
        tools={tools}
        labelled={labelled}
        className={titleButtonClass}
      >
        <GuidesIcon />
      </LogoGuidesButton>
    </div>
  );
}
