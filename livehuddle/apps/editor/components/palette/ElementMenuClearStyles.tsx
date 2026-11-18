'use client';

// The element menu's quick bar (docs/specs/008-canvas/element-menu-quick-bar.md): a toolbar above the menu's first
// category, as livediagram's, holding Clear Styles' eraser at its right while the element takes a quick style (the
// owner, 2026-11-18: a toolbar item at the top, "not an option in the dropdown as a full width row"). Not drawn on an
// element with nothing to clear.
import type { Element } from '@livehuddle/document';
import { Glyph } from '@livehuddle/ui';
import { PopoverButton } from '@/components/canvas/SelectionPopoverButton';
import { useClearStyles } from '@liveworkspace/workbench/lib/clear-styles-store';

// Clear Styles' eraser.
function ClearStylesGlyph() {
  return (
    <Glyph size={14} units={16}>
      <path d="M9.5 2.5 13.5 6.5 7 13H3.5L2 11.5z" />
      <path d="M6 6l4 4" />
      <path d="M8 13h6" />
    </Glyph>
  );
}

export function ElementMenuQuickBar({ target, onClose }: { target: Element; onClose: () => void }) {
  const clearStyles = useClearStyles();
  if (!clearStyles || !clearStyles.targetIds.has(target.id)) return null;
  return (
    <div
      role="toolbar"
      aria-label="Element tools"
      data-element-quick-bar=""
      className="flex items-center gap-0.5 border-b border-slate-100 px-1.5 py-1 dark:border-slate-800"
    >
      <span className="ml-auto flex items-center">
        <PopoverButton
          label="Clear Styles"
          description="Put this element back to the tab's theme."
          onClick={() => {
            // Tracked as QuickClearStyles, the token the old Quick Style panel's Clear Styles sent.
            clearStyles.clear();
            onClose();
          }}
        >
          <ClearStylesGlyph />
        </PopoverButton>
      </span>
    </div>
  );
}
