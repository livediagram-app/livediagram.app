'use client';

// The toolbar's Font (docs/specs/029-sheets/sheet.md "Formatting"): a button naming the active cell's font in its own
// face, left of Font Size, opening the Font menu (SheetToolbarMenus). Unset, the sheet's font: Default.
import { FONTS, resolveFontStack } from '@livediagram/document';
import { ChevronDownIcon, Tooltip } from '@livediagram/ui';

// The button's width on the toolbar: room for the longest name (Permanent Marker) at 12px, and the chevron.
export const FONT_BUTTON_PX = 132;

export function fontLabel(id: string | undefined): string {
  return (id && FONTS.find((f) => f.id === id)?.label) || 'Default';
}

export function SheetFontButton({
  font,
  onOpen,
}: {
  font: string | undefined;
  onOpen: (anchor: HTMLElement) => void;
}) {
  const label = fontLabel(font);
  return (
    <Tooltip label="Font">
      <button
        type="button"
        aria-label={`Font: ${label}`}
        aria-haspopup="menu"
        className="flex h-7 shrink-0 cursor-pointer items-center justify-between gap-1 rounded-md border border-slate-200 px-2 text-[12px] text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        style={{ width: FONT_BUTTON_PX }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => onOpen(e.currentTarget)}
      >
        <span className="truncate" style={{ fontFamily: resolveFontStack(font) }}>
          {label}
        </span>
        <ChevronDownIcon size={12} />
      </button>
    </Tooltip>
  );
}
