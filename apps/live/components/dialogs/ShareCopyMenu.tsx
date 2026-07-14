'use client';

import { useRef, useState, type ReactNode } from 'react';
import { MenuTile, MenuTileGrid, PortalMenu } from '@/components/primitives/PortalMenu';
import { Tooltip } from '@/components/primitives/Tooltip';
import { useToast } from '@/hooks/ui/useToast';
import { track } from '@/lib/telemetry';

// A labelled Share-dialog button that drops a menu of clipboard-copy
// actions (spec/33 + spec/54). Shared by the Embed and Live image
// controls: each is the same affordance — a button with a trailing
// ellipsis (signalling "opens a menu", not "copies on click") that drops
// a list of "copy this as X" rows — so they live in one component rather
// than two near-identical ones. Rendered for non-password links only by
// the caller where an <img>/embed can't carry a password.
type ShareCopyItem = {
  label: string;
  icon: ReactNode;
  // The text placed on the clipboard.
  text: string;
  // What was copied, for the toast ("Copied <what>").
  what: string;
};

export function ShareCopyMenu({
  label,
  tooltipTitle,
  tooltipDescription,
  // Telemetry `type` for the copy event (UI / Copied / <trackType>).
  trackType,
  items,
  header,
}: {
  label: string;
  tooltipTitle: string;
  tooltipDescription: string;
  trackType: string;
  items: ShareCopyItem[];
  // Optional controls pinned above the copy rows inside the menu — used
  // by the Live image control for its per-tab picker (spec/54). Lives
  // inside the PortalMenu so interacting with it doesn't dismiss the menu
  // (the menu only closes on a click outside its own DOM).
  header?: ReactNode;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const toast = useToast();

  const copy = async (item: ShareCopyItem) => {
    setOpen(false);
    try {
      await navigator.clipboard.writeText(item.text);
      toast.success(`Copied ${item.what}`);
      track('UI', 'Copied', trackType);
    } catch {
      toast.error(`Could not copy the ${item.what}. Try again.`);
    }
  };

  return (
    <>
      <Tooltip title={tooltipTitle} description={tooltipDescription}>
        <button
          ref={ref}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-600 dark:text-slate-300 dark:hover:border-brand-400 dark:hover:text-brand-300"
        >
          {label}
          <EllipsisGlyph />
        </button>
      </Tooltip>
      {open ? (
        <PortalMenu anchor={ref.current} placement="below" onClose={() => setOpen(false)}>
          {header ? (
            <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-700">
              {header}
            </div>
          ) : null}
          <MenuTileGrid cols={2}>
            {items.map((item) => (
              <MenuTile
                key={item.label}
                icon={<span className="[&_svg]:h-5 [&_svg]:w-5">{item.icon}</span>}
                label={item.label}
                onClick={() => void copy(item)}
              />
            ))}
          </MenuTileGrid>
        </PortalMenu>
      ) : null}
    </>
  );
}

// Horizontal ellipsis (⋯) after the label, so the button reads as
// "opens a menu" rather than a one-shot copy.
function EllipsisGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="currentColor"
      aria-hidden
      className="-mr-0.5 opacity-70"
    >
      <circle cx="3.5" cy="8" r="1.2" />
      <circle cx="8" cy="8" r="1.2" />
      <circle cx="12.5" cy="8" r="1.2" />
    </svg>
  );
}
