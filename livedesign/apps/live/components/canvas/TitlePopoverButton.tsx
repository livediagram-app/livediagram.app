'use client';

// A page's title-bar control that opens a popover: a logo page's Guides and Mirror
// (docs/specs/007-editor/logo-pages.md "Beside the cog") and a wireframe page's
// Background and Layouts (pages-mode.md "Beside the cog"). Pressed while its tool is on for
// the page (or, with no `on`, tinted while its popover is open), named beside its icon on a
// desktop, the popover anchored under it; on a phone it opens as a bottom sheet instead.
import { useRef, useState, type ReactNode } from 'react';
import { Tooltip, useClickOutside, useEscape } from '@livedesign/ui';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import { BottomSheet } from '@liveworkspace/workbench/components/primitives/BottomSheet';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';

// The tour's step card: a press on it is the tour's, never an outside press that closes the popover under it.
const TOUR_CARD = '[data-tour-popover]';

/** The title-bar controls' look: the cog's size, named beside the icon when `labelled`, tinted while on. */
export function titleButtonClass(on: boolean | undefined, labelled: boolean): string {
  return `flex h-6 items-center justify-center rounded-md transition ${
    labelled ? 'gap-1 px-1.5 text-[11px] font-medium' : 'w-6'
  } focus-visible:outline-2 focus-visible:outline-brand-600 ${
    on
      ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
      : 'text-slate-500 hover:bg-white hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100'
  }`;
}

export function TitlePopoverButton({
  name,
  on,
  labelled,
  className,
  icon,
  width,
  padded = true,
  onOpen,
  openRequest = 0,
  children,
}: {
  // The control's name: its label, its tooltip and the popover's name (on or off is aria-pressed).
  name: string;
  // Whether its tool is on for the page (`aria-pressed`); absent, it is a plain opener.
  on?: boolean;
  // Named beside its icon (a desktop).
  labelled: boolean;
  // The title bar's button look, pressed while on.
  className: (on: boolean, labelled: boolean) => string;
  icon: ReactNode;
  width: number;
  // The popover's own padding; off for a body whose sections bring theirs (Background).
  padded?: boolean;
  // Called as the popover opens (its telemetry).
  onOpen?: () => void;
  // Opens the popover from elsewhere each time it changes (an article toolbar's Style command); 0 never does.
  openRequest?: number;
  // The popover's body, or a function of its close (a body that closes itself, Layouts).
  children: ReactNode | ((close: () => void) => ReactNode);
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const [seenRequest, setSeenRequest] = useState(openRequest);
  if (openRequest !== seenRequest) {
    setSeenRequest(openRequest);
    if (openRequest) setOpen(true);
  }
  const mobile = useIsMobileViewport();
  const close = () => setOpen(false);
  const body = typeof children === 'function' ? children(close) : children;
  return (
    <>
      {/* Its name: whether it is on is aria-pressed and the pressed look. */}
      <Tooltip label={name}>
        <button
          ref={setAnchor}
          type="button"
          aria-label={name}
          aria-haspopup="dialog"
          data-title-popover-trigger=""
          aria-expanded={open}
          {...(on === undefined ? {} : { 'aria-pressed': on })}
          onClick={() => {
            if (!open) onOpen?.();
            setOpen(!open);
          }}
          className={className(on ?? open, labelled)}
        >
          {icon}
          {labelled ? <span aria-hidden>{name}</span> : null}
        </button>
      </Tooltip>
      {open && mobile ? (
        <TitleSheet name={name} onClose={close}>
          {body}
        </TitleSheet>
      ) : open && anchor ? (
        <AnchoredPopover
          anchor={anchor}
          name={name}
          width={width}
          onClose={close}
          // A tour step opened it (docs/specs/007-editor/pages-tour.md): pressing the tour's card keeps it.
          keepOpenWithin={TOUR_CARD}
        >
          <div
            className={`rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900 ${
              padded ? 'p-3' : 'py-1'
            }`}
          >
            {body}
          </div>
        </AnchoredPopover>
      ) : null}
    </>
  );
}

// On a phone: the body in a bottom sheet, named, closed by a swipe down, an outside press or
// Escape (a colour popover it opens is its own).
function TitleSheet({
  name,
  onClose,
  children,
}: {
  name: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  // Its own button toggles it, so a press there is not an outside one.
  useClickOutside(
    sheet,
    onClose,
    true,
    `[data-anchored-popover], [data-title-popover-trigger], ${TOUR_CARD}`,
  );
  useEscape(onClose, { capture: true, stopPropagation: true });
  return (
    <BottomSheet
      ref={sheet}
      role="dialog"
      aria-label={name}
      onClose={onClose}
      zClassName="z-[var(--z-overlay)]"
      onPointerDown={(e) => e.stopPropagation()}
    >
      <p className="px-4 pb-1 pt-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
        {name}
      </p>
      <div className="pb-2">{children}</div>
    </BottomSheet>
  );
}
