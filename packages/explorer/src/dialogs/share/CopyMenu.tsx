'use client';

// A pass's Embed and Live image buttons: a labelled button with a trailing ⋯ (it opens a menu, it doesn't copy on
// a click), named by a hover card, that drops a list of "copy this as …" rows. The Live image's menu holds its tab picker above the rows.

import { useState, type ReactNode } from 'react';
import { HoverCard } from '@liveworkspace/ui';
import { MenuActionRow, PortalMenu } from '../../ui/Menu';
import { EllipsisGlyph } from './glyphs';
import type { ShareNotify, ShareTelemetry } from './types';

export type CopyItem = {
  label: string;
  icon: ReactNode;
  // What goes on the clipboard.
  text: string;
  // What was copied, for the note ("Copied embed URL").
  what: string;
};

export function CopyMenu({
  label,
  description,
  telemetryType,
  items,
  header,
  notify,
  onTelemetry,
}: {
  label: string;
  // What the button offers, on hover.
  description: string;
  telemetryType: string;
  items: CopyItem[];
  header?: ReactNode;
  notify: ShareNotify;
  onTelemetry?: ShareTelemetry;
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const [open, setOpen] = useState(false);
  const copy = async (item: CopyItem) => {
    setOpen(false);
    if (await writeClipboard(item.text)) {
      notify(`Copied ${item.what}`, 'success');
      onTelemetry?.('Copied', telemetryType);
    } else {
      notify(`Couldn’t copy the ${item.what}. Try again.`, 'error');
    }
  };
  return (
    <>
      {/* The card stays shut while the menu is open, which it would sit over. */}
      <HoverCard title={label} description={description} disabled={open}>
        <button
          ref={setAnchor}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="menu"
          aria-expanded={open}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition duration-micro hover:border-brand-300 hover:text-brand-700 dark:border-slate-600 dark:text-slate-300 dark:hover:border-brand-400 dark:hover:text-brand-300"
        >
          {label}
          <EllipsisGlyph />
        </button>
      </HoverCard>
      {open ? (
        <PortalMenu anchor={anchor} onClose={() => setOpen(false)} label={label}>
          {header ? (
            <div className="border-b border-slate-100 px-3 py-2 dark:border-slate-700">
              {header}
            </div>
          ) : null}
          {/* One row per copy action, icon left: a short verb list that reads down like a dropdown. */}
          <div className="min-w-44">
            {items.map((item) => (
              <MenuActionRow
                key={item.label}
                icon={item.icon}
                label={item.label}
                onClick={() => void copy(item)}
              />
            ))}
          </div>
        </PortalMenu>
      ) : null}
    </>
  );
}

export async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
