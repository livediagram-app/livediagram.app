import type { SheetDrag } from './useSheetDrag';

// The tallest strip a phone sheet's grab handle takes: the full width of the sheet, this tall, so a thumb finds it
// without aiming for the pill (docs/specs/004-interface-design/touch-targets.md).
export const SHEET_HANDLE_PX = 32;

// The grab handle every phone sheet opens with (BottomSheet, Dialog's phoneSheet, the start panel): a full-width strip
// that drags the sheet (useSheetDrag), its pill centred. It must be the sheet's direct child: the drag measures its
// parent.
export function SheetHandle({
  handleProps,
  className = '',
  pillColor,
}: {
  handleProps: SheetDrag['handleProps'];
  // Extra classes for the strip (`sm:hidden` where the sheet is a sheet only on a phone).
  className?: string;
  // The pill's colour where the sheet wears its own palette; else the shared slate.
  pillColor?: string;
}) {
  return (
    <div
      aria-hidden
      data-sheet-handle=""
      {...handleProps}
      className={`flex shrink-0 cursor-grab touch-none items-center justify-center ${className}`}
      style={{ height: SHEET_HANDLE_PX }}
    >
      <span
        className={`h-1.5 w-12 rounded-full${pillColor ? '' : ' bg-slate-300 dark:bg-slate-600'}`}
        style={pillColor ? { backgroundColor: pillColor } : undefined}
      />
    </div>
  );
}
