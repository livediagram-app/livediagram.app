'use client';

// The element menu's quick bar (docs/specs/008-canvas/element-menu-quick-bar.md): a row above the menu's first
// category holding Clear Styles, which resets the element's quick-style look. It is drawn only while the element
// takes a quick style. Assign Action, Add Comment, Add Link and Add Note left livehuddle
// (docs/specs/002-project-scope/not-in-livehuddle.md "Comments, actions, links and notes"), so the bar offers no
// attachment, for any element or role.
import type { Element } from '@livehuddle/document';
import { Glyph, Tooltip } from '@livehuddle/ui';
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

const BUTTON =
  'relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-md transition focus-visible:outline-2 focus-visible:outline-brand-600';
const REST =
  'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white';

export function ElementMenuQuickBar({ target, onClose }: { target: Element; onClose: () => void }) {
  const clearStyles = useClearStyles();
  if (!clearStyles || !clearStyles.targetIds.has(target.id)) return null;
  return (
    <div
      role="toolbar"
      aria-label="Quick actions"
      data-element-quick-bar=""
      className="flex items-center gap-0.5 border-b border-slate-100 px-1.5 py-1 dark:border-slate-800"
    >
      <Tooltip label="Clear Styles">
        <button
          type="button"
          aria-label="Clear Styles"
          data-quick-bar="clear-styles"
          onClick={() => {
            // Tracked as QuickClearStyles, the token the old Quick Style panel's Clear Styles sent.
            clearStyles.clear();
            onClose();
          }}
          className={`${BUTTON} ${REST} ml-auto`}
        >
          <ClearStylesGlyph />
        </button>
      </Tooltip>
    </div>
  );
}
