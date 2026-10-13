'use client';

// An article page's Style and Text beside its cog (docs/specs/007-editor/article-pages.md "Beside the cog"): the
// page panel's two article tabs, each in a popover anchored to its button, as an infographic or slide page's
// Layouts and Background open theirs. The writing's whole article takes a pick; hovers preview on it.
import type { ReactNode } from 'react';
import { lucideALargeSmall, lucidePalette } from '@livediagram/icons/lucide';
import { lucideGlyph } from '@livediagram/ui';
import { track } from '@/lib/telemetry';
import { TitlePopoverButton, titleButtonClass } from './TitlePopoverButton';

const StyleIcon = lucideGlyph(lucidePalette, 14);
const TextIcon = lucideGlyph(lucideALargeSmall, 14);

// The title-bar room each takes (24 px and the gap, or named beside its icon), so the label truncates first.
const BUTTON_ROOM = 28;
const STYLE_LABELLED_ROOM = 66;
const TEXT_LABELLED_ROOM = 60;
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
}: {
  // Named beside their icons (a desktop).
  labelled: boolean;
  // Opens Style each time it changes: the article toolbar's Style command for this page; 0 never does.
  styleRequest: number;
  // The article's Style or Text sections (ArticleStyleSection), for this page's article.
  section: (part: 'style' | 'text') => ReactNode;
}) {
  return (
    <div
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
        openRequest={styleRequest}
        onOpen={() => track('UI', 'Opened', 'PageArticleStyleButton')}
      >
        {section('style')}
      </TitlePopoverButton>
      <TitlePopoverButton
        name="Text"
        labelled={labelled}
        className={titleButtonClass}
        icon={<TextIcon />}
        width={POPOVER_WIDTH}
        onOpen={() => track('UI', 'Opened', 'PageArticleTextButton')}
      >
        {section('text')}
      </TitlePopoverButton>
    </div>
  );
}
