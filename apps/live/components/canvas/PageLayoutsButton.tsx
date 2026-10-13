'use client';

// An infographic or slide page's Layout button beside its cog (docs/specs/007-editor/illustrate-pages.md
// "Beside the cog", "Layouts"): the page's layouts by category in a popover anchored to the button
// (a bottom sheet on a phone), as Background opens its swatches. Hovering a tile previews it on the
// page; a press places it (over anything there, one undo step back) and closes the popover; closing it
// takes any preview away.
import { useEffect, useRef } from 'react';
import { lucidePanelsTopLeft } from '@livediagram/icons/lucide';
import type { LaidOutPage } from '@livediagram/document';
import type { PageLayoutId } from '@livediagram/templates';
import { lucideGlyph } from '@livediagram/ui';
import { useIsMobileViewport } from '@/hooks/ui/useIsMobileViewport';
import { track } from '@/lib/telemetry';
import { LayoutBrowser } from './infographic-page-layouts-section';
import { TitlePopoverButton, titleButtonClass } from './TitlePopoverButton';

const LayoutsIcon = lucideGlyph(lucidePanelsTopLeft, 14);

// The title-bar room it takes (24 px and the gap, or named beside its icon), so the page's label
// truncates first.
const LAYOUTS_ROOM = 28;
const LAYOUTS_LABELLED_ROOM = 78;
// Four tiles across, as the wide in-page card sets them, so a category shows without scrolling.
const POPOVER_WIDTH = 560;

/** The room the button takes in the title bar: named on a desktop, its icon alone on a phone. */
export function pageLayoutsRoom(labelled: boolean): number {
  return labelled ? LAYOUTS_LABELLED_ROOM : LAYOUTS_ROOM;
}

type BodyProps = {
  page: LaidOutPage;
  onApply: (layout: PageLayoutId) => void;
  onPreview: (layout: PageLayoutId | null) => void;
};

// The popover's body; unmounting (the popover closing) takes the preview off the page.
function Body({ page, onApply, onPreview, wide }: BodyProps & { wide: boolean }) {
  // Only on close: the callback is a fresh closure each render, so it is read through a ref.
  const clearPreview = useRef(onPreview);
  useEffect(() => {
    clearPreview.current = onPreview;
  });
  useEffect(() => () => clearPreview.current(null), []);
  return (
    <div data-page-layouts-popover="" className={wide ? '' : 'px-3'}>
      <LayoutBrowser page={page} onApply={onApply} onPreview={onPreview} wide={wide} />
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
            onApply={(layout) => {
              props.onPreview(null);
              props.onApply(layout);
              close();
            }}
          />
        )}
      </TitlePopoverButton>
    </div>
  );
}
