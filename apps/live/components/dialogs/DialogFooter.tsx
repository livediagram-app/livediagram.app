import type { ReactNode } from 'react';

// The dialog action row: a right-aligned strip of buttons above the dialog's
// bottom edge. The sibling of DialogHeader, and extracted for the same reason
// — nine places had typed the same class string out inline.
//
// The padding here is the `px-6 py-4` that seven of the nine already used.
// AssignAction and LinkPicker are the other two: both sit at that size and
// differ only in flex props they do not exercise. AssignAction omitted
// `items-center` while holding two buttons of equal height, and LinkPicker
// omitted both it and `gap-2` while holding a single button, so neither had
// anything to align or space. They render identically here.
//
// Footers of a different SIZE keep their own markup, the way DialogHeader
// leaves the compact headers alone: MoveToFolder and its neighbours use a
// tighter `px-5 py-3`, and those all agree with each other, so that reads as a
// deliberate compact dialog rather than drift. Folding them in would silently
// reflow them, which is a design call and not a refactor's to make.
//
// The buttons are a children slot rather than props because no two footers
// agree on them: one Remove link, Cancel + Save, Cancel + a danger Delete,
// and Share's row of three.
export function DialogFooter({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4 dark:border-slate-800">
      {children}
    </div>
  );
}
