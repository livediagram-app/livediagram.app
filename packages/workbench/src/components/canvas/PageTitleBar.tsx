'use client';

// A page's title bar (docs/specs/007-editor/pages-mode.md "Beside the cog"): the controls above a
// page's top-right corner, as one small toolbar card rather than loose buttons on the canvas. Its
// controls come in groups, a hairline between them, so it reads at a glance: what the page looks
// like (Layout, Background, an article's Style and Text), then tools (Add Notes, Tidy, an editor's
// own), then the page itself (its lock and its settings cog) last, at the corner. Every editor with
// pages builds its bar from these, so they look and measure the same.
import { Fragment, type CSSProperties, type ReactNode, type Ref } from 'react';
import { lucideSettings } from '@liveworkspace/icons/lucide';
import { lucideGlyph, Tooltip } from '@liveworkspace/ui';

const CogIcon = lucideGlyph(lucideSettings, 14);

// Screen px, for the room the bar takes (each editor's page-title-bar-room): a button's height and an
// icon-only button's width, the gap between buttons, the card's own padding and border on each side,
// and a divider with its margins.
export const TITLE_BAR_BUTTON = 28;
export const TITLE_BAR_GAP = 2;
const TITLE_BAR_EDGE = 3;
const TITLE_BAR_DIVIDER = 1 + 2 * 4;

/** The title bar's own room beyond its buttons: the card's edges, and a divider between groups with
 *  a gap between every two things in the row (buttons and dividers alike). `buttons` and `groups`
 *  count what shows. */
export function titleBarChromeRoom(buttons: number, groups: number): number {
  if (buttons === 0) return 0;
  const dividers = Math.max(0, groups - 1);
  return (
    2 * TITLE_BAR_EDGE + (buttons + dividers - 1) * TITLE_BAR_GAP + dividers * TITLE_BAR_DIVIDER
  );
}

/** A control's look in the bar: 28 px tall, its icon alone (28 px square) or named beside it, quiet
 *  until hovered, tinted while `on` (its tool on, or its popover open). */
export function titleBarButtonClass(on: boolean | undefined, labelled: boolean): string {
  return `relative flex h-7 shrink-0 items-center justify-center rounded-md text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-600 ${
    labelled ? 'gap-1.5 pl-2 pr-2.5' : 'w-7'
  } ${
    on
      ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
  }`;
}

/** The card: its groups in order, empty ones left out, a hairline between those that show. Held at
 *  one screen size and placed by the caller. */
export function PageTitleBar({
  groups,
  className = '',
  style,
  keepArticleActive = false,
}: {
  groups: readonly (readonly ReactNode[])[];
  className?: string;
  style?: CSSProperties;
  // A press on it keeps an article's toolbar (livedocuments' data-article-keep-active).
  keepArticleActive?: boolean;
}) {
  const shown = groups
    .map((group) => group.filter((item) => item !== null && item !== undefined && item !== false))
    .filter((group) => group.length > 0);
  if (shown.length === 0) return null;
  return (
    <div
      role="toolbar"
      aria-label="Page"
      data-page-title-bar=""
      data-article-keep-active={keepArticleActive ? '' : undefined}
      // A press here is the bar's, never the canvas's (no marquee, no deselect, no draw).
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      style={style}
      // No backdrop blur: every page wears one of these bars in canvas space, under the element layer.
      // Safari re-ran each bar's blur whenever anything behind it repainted, so a keystroke on a 100-page
      // article cost about 60 ms and every element repainted on each frame of a drag
      // (canvas-performance.md "Chrome on every page" in livedocuments, "Nothing in canvas space blurs
      // what is behind it" in livedesign). At 95% white the blur never showed.
      className={`pointer-events-auto flex items-center gap-0.5 rounded-[10px] border border-slate-200/90 bg-white/95 p-0.5 shadow-[0_1px_2px_rgb(15_23_42/0.06),0_4px_12px_-4px_rgb(15_23_42/0.12)] dark:border-slate-700/80 dark:bg-slate-900/95 ${className}`}
    >
      {shown.map((group, i) => (
        <Fragment key={i}>
          {i > 0 ? (
            <span
              aria-hidden
              data-page-title-bar-divider=""
              className="mx-1 h-4 w-px shrink-0 bg-slate-200 dark:bg-slate-700"
            />
          ) : null}
          {group.map((item, j) => (
            <Fragment key={j}>{item}</Fragment>
          ))}
        </Fragment>
      ))}
    </div>
  );
}

/** The page's settings cog, last in the bar at the page's corner: opens the page's panel. */
export function PageCog({
  name,
  open,
  onToggle,
  cogRef,
}: {
  name: string;
  open: boolean;
  onToggle: () => void;
  cogRef: Ref<HTMLButtonElement>;
}) {
  return (
    <Tooltip label={name}>
      <button
        ref={cogRef}
        type="button"
        aria-label={name}
        aria-haspopup="dialog"
        aria-expanded={open}
        data-page-panel-trigger
        // The Pages tour's anchor (docs/specs/007-editor/pages-tour.md); the first page's leads.
        data-tour-id="page-cog"
        onClick={() => onToggle()}
        className={`relative touch-target-y ${titleBarButtonClass(open, false)}`}
      >
        <CogIcon />
      </button>
    </Tooltip>
  );
}
