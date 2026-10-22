'use client';

// An infographic or slide page's Tidy, its icon alone, left of the lock and cog in the title bar
// (docs/specs/007-editor/pages-mode.md "Tidy"), shown only while a press would change
// something: a press aligns and spaces what is on the page, one edit (pageEdits.tidyPage, the pure lib/page-tidy.ts). On a desktop pointer,
// hovering it shows the tidied page in place; leaving it puts the page back. An Editor's alone: the
// title bar shows controls only to someone who may edit, and the button checks the session's
// `can` itself.
import { useContext, useEffect, useRef } from 'react';
import { lucideBrushCleaning } from '@livedesign/icons/lucide';
import { lucideGlyph, Tooltip } from '@livedesign/ui';
import { EditorContext } from '@/app/document/[id]/EditorContext';
import type { PageEdits } from '@/hooks/editor/page-edits';
import { titleButtonClass } from './TitlePopoverButton';

const TidyUpIcon = lucideGlyph(lucideBrushCleaning, 14);

// The title-bar room it takes (24 px and the gap: it is an icon alone), so the page's label
// truncates first.
const TIDY_UP_ROOM = 28;

export const PAGE_TIDY_UP_TOOLTIP = 'Tidy: align and space what is on this page';

/** The room the button takes in the title bar: its icon alone, on a desktop and a phone. */
export function pageTidyUpRoom(): number {
  return TIDY_UP_ROOM;
}

export function PageTidyUpButton({
  pageId,
  edit,
}: {
  pageId: string;
  // The pages view's edits (absent ones render nothing).
  edit: Pick<PageEdits, 'tidyPage' | 'previewTidy'>;
}) {
  const editor = useContext(EditorContext);
  const { tidyPage, previewTidy } = edit;
  // Leaving mid-hover (the button going: the page locked, the mode left) drops the preview.
  const previewing = useRef(false);
  const clear = useRef(previewTidy);
  useEffect(() => {
    clear.current = previewTidy;
  });
  useEffect(
    () => () => {
      if (previewing.current) clear.current?.(null);
    },
    [],
  );
  // Editors only: a Participant and a Viewer never reshape a page.
  if (editor?.can.level !== 'edit' || !tidyPage) return null;
  return (
    <div
      // The title bar takes no pointer events: the button opts back in, and a press on it is its
      // own, never the canvas's (no marquee, no deselect, no draw).
      className="pointer-events-auto flex items-center"
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <Tooltip label={PAGE_TIDY_UP_TOOLTIP}>
        <button
          type="button"
          aria-label={PAGE_TIDY_UP_TOOLTIP}
          data-page-tidy-up={pageId}
          onPointerEnter={(e) => {
            if (e.pointerType !== 'mouse' || !previewTidy) return;
            previewing.current = true;
            previewTidy(pageId);
          }}
          onPointerLeave={() => {
            if (!previewing.current) return;
            previewing.current = false;
            previewTidy?.(null);
          }}
          onClick={() => {
            previewing.current = false;
            tidyPage(pageId);
          }}
          className={titleButtonClass(false, false)}
        >
          <TidyUpIcon />
        </button>
      </Tooltip>
    </div>
  );
}
