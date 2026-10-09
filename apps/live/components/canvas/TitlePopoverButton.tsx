'use client';

// A logo page's title-bar control that opens a popover (docs/specs/007-editor/logo-pages.md
// "Beside the cog"): Guides and Mirror. Pressed while its tool is on for the page, named beside
// its icon on a desktop, the popover anchored under it.
import { useState, type ReactNode } from 'react';
import { Tooltip } from '@livediagram/ui';
import { AnchoredPopover } from '@/components/primitives/AnchoredPopover';

export function TitlePopoverButton({
  name,
  on,
  labelled,
  className,
  icon,
  width,
  children,
}: {
  // The control's name: its label, tooltip ("<name>: on" while on) and the popover's name.
  name: string;
  on: boolean;
  // Named beside its icon (a desktop).
  labelled: boolean;
  // The title bar's button look, pressed while on.
  className: (on: boolean, labelled: boolean) => string;
  icon: ReactNode;
  width: number;
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
          aria-pressed={on}
          onClick={() => setOpen((v) => !v)}
          className={className(on, labelled)}
        >
          {icon}
          {labelled ? <span aria-hidden>{name}</span> : null}
        </button>
      </Tooltip>
      {open && anchor ? (
        <AnchoredPopover anchor={anchor} name={name} width={width} onClose={() => setOpen(false)}>
          <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            {children}
          </div>
        </AnchoredPopover>
      ) : null}
    </>
  );
}
