'use client';

// A page's title-bar control that opens a popover: a logo page's Guides and Mirror
// (docs/specs/007-editor/logo-pages.md "Beside the cog") and an infographic or slide page's
// Background (illustrate-pages.md "Beside the cog"). Pressed while its tool is on for the page (or,
// with no `on`, tinted while its popover is open), named beside its icon on a desktop, the popover
// anchored under it.
import { useState, type ReactNode } from 'react';
import { Tooltip } from '@livediagram/ui';
import { AnchoredPopover } from '@/components/primitives/AnchoredPopover';

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
  children,
}: {
  // The control's name: its label, tooltip ("<name>: on" while on) and the popover's name.
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
  // The popover's body.
  children: ReactNode;
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  return (
    <>
      <Tooltip label={on ? `${name}: on` : name}>
        <button
          ref={setAnchor}
          type="button"
          aria-label={name}
          aria-haspopup="dialog"
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
      {open && anchor ? (
        <AnchoredPopover anchor={anchor} name={name} width={width} onClose={() => setOpen(false)}>
          <div
            className={`rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900 ${
              padded ? 'p-3' : 'py-1'
            }`}
          >
            {children}
          </div>
        </AnchoredPopover>
      ) : null}
    </>
  );
}
