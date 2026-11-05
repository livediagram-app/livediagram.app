'use client';

// An article page's Style and Text beside its cog (docs/specs/007-editor/article-pages.md "Beside the cog"): the
// page panel's two article tabs, each in a popover anchored to its button, as an infographic or slide page's
// Layouts and Background open theirs. The writing's whole article takes a pick; hovers preview on it. Style is
// the page's one Style: its popover leads with Tab Style (TabStyleRow), the whole tab's look, so an article page
// never shows two Style buttons (docs/specs/011-theme/canvas-and-theme-dialog.md "Opening it").
import { useState, type ReactNode } from 'react';
import { lucideALargeSmall, lucideChevronRight, lucidePalette } from '@liveworkspace/icons/lucide';
import { lucideGlyph } from '@livedocuments/ui';
import { openTabStyleFrom } from '@/lib/tab-style-opener';
import { track } from '@/lib/telemetry';
import { TitlePopoverButton, titleButtonClass } from './TitlePopoverButton';

const StyleIcon = lucideGlyph(lucidePalette, 14);
const TextIcon = lucideGlyph(lucideALargeSmall, 14);
const TileIcon = lucideGlyph(lucidePalette, 15);
const ChevronIcon = lucideGlyph(lucideChevronRight, 14);

// The title-bar room each takes (24 px and the gap, or named beside its icon), so the label truncates first.
const BUTTON_ROOM = 28;
const STYLE_LABELLED_ROOM = 67;
const TEXT_LABELLED_ROOM = 62;
// The page panel's own width, so the sections lay out as they do there.
const POPOVER_WIDTH = 304;

/** The room the two buttons take in the title bar: named on a desktop, icons alone on a phone. */
export function pageArticleRoom(labelled: boolean): number {
  return labelled ? STYLE_LABELLED_ROOM + TEXT_LABELLED_ROOM : BUTTON_ROOM * 2;
}

export function PageArticleButtons({
  labelled,
  styleRequest,
  section,
  tabStyle = false,
  textRequest = 0,
  headless = false,
}: {
  // Opens Text each time it changes (a phone's Appearance sheet); 0 never does.
  textRequest?: number;
  // No buttons of their own: a phone's Appearance sheet opens them (TitlePopoverButton's headless).
  headless?: boolean;
  // Named beside their icons (a desktop).
  labelled: boolean;
  // Opens Style each time it changes: the article toolbar's Style command for this page; 0 never does.
  styleRequest: number;
  // The article's Style or Text sections (ArticleStyleSection), for this page's article.
  section: (part: 'style' | 'text') => ReactNode;
  // Tab Style is offered here (an Editor's, outside an embed): Style's popover leads with it.
  tabStyle?: boolean;
}) {
  // Held in state, not a ref: the popover body reads it as it renders.
  const [root, setRoot] = useState<HTMLDivElement | null>(null);
  return (
    <div
      ref={setRoot}
      // The title bar takes no pointer events: the buttons opt back in, and a press on them is their
      // own, never the canvas's (no marquee, no deselect, no draw).
      className="pointer-events-auto flex items-center gap-1"
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <TitlePopoverButton
        name="Style"
        labelled={labelled}
        className={titleButtonClass}
        icon={<StyleIcon />}
        width={POPOVER_WIDTH}
        padded={false}
        openRequest={styleRequest}
        headless={headless}
        onOpen={() => track('UI', 'Opened', 'PageArticleStyleButton')}
      >
        {(close) => (
          <>
            {tabStyle ? (
              <TabStyleRow
                onOpen={() => {
                  close();
                  track('UI', 'Opened', 'ThemePicker');
                  // The dialog drops from this page's Style button, as from a slide's.
                  openTabStyleFrom(root?.querySelector('button') ?? null);
                }}
              />
            ) : null}
            {section('style')}
          </>
        )}
      </TitlePopoverButton>
      <TitlePopoverButton
        name="Text"
        labelled={labelled}
        className={titleButtonClass}
        icon={<TextIcon />}
        width={POPOVER_WIDTH}
        padded={false}
        openRequest={textRequest}
        headless={headless}
        onOpen={() => track('UI', 'Opened', 'PageArticleTextButton')}
      >
        {section('text')}
      </TitlePopoverButton>
    </div>
  );
}

/** Style's first row on an article page: the whole tab's look (Tab Style), one press away, above the article's own
 *  style. A grouped settings row, iOS style, as the Tab Style dialog's own rows are. */
function TabStyleRow({ onOpen }: { onOpen: () => void }) {
  return (
    <div className="border-b border-slate-100 px-3 pb-2.5 pt-2 dark:border-slate-800">
      <button
        type="button"
        onClick={onOpen}
        data-article-tab-style=""
        className="group flex w-full cursor-pointer items-center gap-2.5 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700/60"
      >
        <span
          aria-hidden
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-brand-700 text-white dark:bg-brand-600"
        >
          <TileIcon />
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[13px] font-semibold text-slate-800 dark:text-slate-100">
            Tab Style
          </span>
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            Theme, finish, fonts and canvas for the whole tab
          </span>
        </span>
        <span
          aria-hidden
          className="shrink-0 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-200"
        >
          <ChevronIcon />
        </span>
      </button>
    </div>
  );
}
