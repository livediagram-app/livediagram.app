'use client';

// The page's icon above its Title (docs/specs/030-knowledgebase/page-surface.md "The page icon"), drawn into the
// writing's head slot (lib/knowledge/page-slots-plugin.ts). For whoever may change it a button that opens the picker
// (a soft ground on hover, "Change Icon"); for anyone else a picture. Nothing at all for a page with none, and its
// slot then takes no room.
import { memo, type ReactNode } from 'react';
import type { TabIcon } from '@liveknowledge/document';
import { Tooltip } from '@liveknowledge/ui';
import { PageIconGlyph } from './PageIconGlyph';
import { PageIconPicker, usePageIconPicker } from './PageIconPicker';
import { usePageIcon, usePageIconEditable } from './page-icon-state';

/** The head icon's size in the page's px: it is in the writing, so a phone's smaller page shows it smaller, as it
 *  shows the Title. */
export const PAGE_ICON_HEAD = 48;

export function PageIconHead() {
  const icon = usePageIcon();
  const editable = usePageIconEditable();
  if (!icon) return null;
  return <PageIconHeadView icon={icon} editable={editable} />;
}

export const PageIconHeadView = memo(function PageIconHeadView({
  icon,
  editable,
}: {
  icon: TabIcon;
  editable: boolean;
}) {
  const glyph = <PageIconGlyph icon={icon} size={PAGE_ICON_HEAD} />;
  if (!editable)
    return (
      <div data-page-icon="" role="img" aria-label="Page icon" className="inline-flex">
        {glyph}
      </div>
    );
  return <EditableHead icon={icon}>{glyph}</EditableHead>;
});

function EditableHead({ icon, children }: { icon: TabIcon; children: ReactNode }) {
  const picker = usePageIconPicker();
  return (
    <>
      <Tooltip label="Change Icon">
        <button
          type="button"
          data-page-icon=""
          aria-label="Change Icon"
          aria-haspopup="dialog"
          aria-expanded={picker.open}
          onClick={(e) => picker.openFrom(e.currentTarget)}
          className={`-m-1.5 inline-flex cursor-pointer rounded-xl p-1.5 transition-colors duration-micro hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600 motion-reduce:transition-none dark:hover:bg-slate-800 ${
            picker.open ? 'bg-slate-100 dark:bg-slate-800' : ''
          }`}
        >
          {children}
        </button>
      </Tooltip>
      <PageIconPicker picker={picker} icon={icon} />
    </>
  );
}
