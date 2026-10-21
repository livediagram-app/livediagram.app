'use client';

// The toolbar's Font (docs/specs/029-sheets/sheet.md "Formatting"): a button naming the active cell's font in its own
// face, left of Font Size, opening the Font menu (SheetToolbarMenus). Unset, the sheet's font: Default.
import { FONTS, resolveFontStack } from '@liveplanner/document';
import { ChevronDownIcon, Tooltip } from '@liveplanner/ui';

// The button's width on the toolbar: room for the longest name (Permanent Marker) at 12px, and the chevron.
export const FONT_BUTTON_PX = 132;

export function fontLabel(id: string | undefined): string {
  return (id && FONTS.find((f) => f.id === id)?.label) || 'Default';
}

export function SheetFontButton({
  font,
  tone,
  onOpen,
}: {
  font: string | undefined;
  // The Sheet's hairline and ink (its palette), as the toolbar and Font Size's stepper beside it wear.
  tone?: { line: string; text: string };
  onOpen: (anchor: HTMLElement) => void;
}) {
  const label = fontLabel(font);
  return (
    <Tooltip label="Font">
      <button
        type="button"
        aria-label={`Font: ${label}`}
        aria-haspopup="menu"
        className={`flex h-7 shrink-0 cursor-pointer items-center justify-between gap-1 rounded-md border px-2 text-[12px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${
          tone
            ? 'hover:bg-black/5 dark:hover:bg-white/10'
            : 'border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800'
        }`}
        style={{
          width: FONT_BUTTON_PX,
          ...(tone ? { borderColor: tone.line, color: tone.text } : {}),
        }}
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
