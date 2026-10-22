'use client';

// An infographic or slide page's Layout button beside its cog (docs/specs/007-editor/pages-mode.md
// "Beside the cog", "The layout gallery"): the page's layout gallery in a popover anchored to the
// button (a bottom sheet on a phone), as Background opens its swatches. Hovering a tile previews it
// on the page; a press places it (over anything there, one undo step back) and closes the popover;
// Surprise Me places one and keeps it open, to roll again; closing it takes any preview away. Its
// top offers Change Theme (the Tab Style popover, as the dock's Theme button opens it) beside an
// X that closes it.
import { useEffect, useRef } from 'react';
import { lucidePanelsTopLeft } from '@livedesign/icons/lucide';
import type { LaidOutPage } from '@livedesign/document';
import type { PageLayoutId } from '@livedesign/templates';
import { CloseIcon, lucideGlyph, Tooltip } from '@livedesign/ui';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { track } from '@/lib/telemetry';
import { ChangeThemeButton } from './ChangeThemeButton';
import { LayoutGallery } from './layout-gallery/LayoutGallery';
import { TitlePopoverButton, titleButtonClass } from './TitlePopoverButton';

const LayoutsIcon = lucideGlyph(lucidePanelsTopLeft, 14);

// The title-bar room it takes (24 px and the gap, or named beside its icon), so the page's label
// truncates first.
const LAYOUTS_ROOM = 28;
const LAYOUTS_LABELLED_ROOM = 78;
// Three slide tiles across (four of a tall page's), each with its description.
const POPOVER_WIDTH = 580;

/** The room the button takes in the title bar: named on a desktop, its icon alone on a phone. */
export function pageLayoutsRoom(labelled: boolean): number {
  return labelled ? LAYOUTS_LABELLED_ROOM : LAYOUTS_ROOM;
}

type BodyProps = {
  page: LaidOutPage;
  onApply: (layout: PageLayoutId) => void;
  // Surprise Me: places a layout without closing (Body's host passes the plain apply).
  onSurprise?: (layout: PageLayoutId) => void;
  onPreview: (layout: PageLayoutId | null) => void;
  // Opens the Tab Style popover; absent where the session may not restyle the tab (no button).
  onChangeTheme?: (() => void) | undefined;
};

// The popover's body; unmounting (the popover closing) takes the preview off the page.
function Body({
  page,
  onApply,
  onSurprise,
  onPreview,
  onChangeTheme,
  wide,
  onClose,
}: BodyProps & { wide: boolean; onClose: () => void }) {
  // Only on close: the callback is a fresh closure each render, so it is read through a ref.
  const clearPreview = useRef(onPreview);
  useEffect(() => {
    clearPreview.current = onPreview;
  });
  useEffect(() => () => clearPreview.current(null), []);
  return (
    <div data-page-layouts-popover="" className={wide ? '' : 'px-3'}>
      <div className="mb-2.5 flex items-center justify-between gap-2">
        {wide ? (
          <p className="pl-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">Layouts</p>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-1">
          {onChangeTheme ? (
            <ChangeThemeButton
              onClick={() => {
                onClose();
                onChangeTheme();
              }}
            />
          ) : null}
          {/* A phone's bottom sheet closes by a swipe or an outside press: no X there. */}
          {wide ? (
            <Tooltip label="Close">
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <CloseIcon size={12} />
              </button>
            </Tooltip>
          ) : null}
        </div>
      </div>
      <LayoutGallery
        page={page}
        onApply={onApply}
        onSurprise={onSurprise}
        onPreview={onPreview}
        described={wide}
        autoFocus={wide}
        maxHeight={wide ? 'min(520px, 62vh)' : '58vh'}
      />
    </div>
  );
}

export function PageLayoutsButton({
  labelled,
  ...props
}: BodyProps & {
  // Named beside its icon (a desktop).
  labelled: boolean;
}) {
  const mobile = useIsMobileViewport();
  return (
    <div
      // The title bar takes no pointer events: the button opts back in, and a press on it is its
      // own, never the canvas's (no marquee, no deselect, no draw).
      className="pointer-events-auto flex items-center"
      data-tour-id="page-layouts"
      onPointerDown={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
    >
      <TitlePopoverButton
        name="Layout"
        labelled={labelled}
        className={titleButtonClass}
        icon={<LayoutsIcon />}
        width={POPOVER_WIDTH}
        onOpen={() => track('UI', 'Opened', 'PageLayoutsButton')}
      >
        {(close) => (
          <Body
            {...props}
            wide={!mobile}
            onClose={close}
            onApply={(layout) => {
              props.onPreview(null);
              props.onApply(layout);
              close();
            }}
            onSurprise={props.onApply}
          />
        )}
      </TitlePopoverButton>
    </div>
  );
}
