'use client';

// The element menu's Clear Styles (docs/specs/008-canvas/element-menu-quick-bar.md): a row of the Appearance group,
// under the Style row whose colours and border it resets, drawn only while the element takes a quick style.
// livehuddle has no quick bar: once Assign Action, Add Comment, Add Link and Add Note left
// (docs/specs/002-project-scope/not-in-livehuddle.md "Comments, actions, links and notes"), the bar was a full-width
// band holding this one eraser (Work Tracker 739), so it became a row of the menu like every other.
import type { Element } from '@livehuddle/document';
import { Glyph } from '@livehuddle/ui';
import { MenuActionRow } from '@liveworkspace/workbench/components/primitives/PortalMenu';
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

export function ElementMenuClearStyles({
  target,
  onClose,
}: {
  target: Element;
  onClose: () => void;
}) {
  const clearStyles = useClearStyles();
  if (!clearStyles || !clearStyles.targetIds.has(target.id)) return null;
  return (
    <MenuActionRow
      label="Clear Styles"
      icon={<ClearStylesGlyph />}
      onClick={() => {
        // Tracked as QuickClearStyles, the token the old Quick Style panel's Clear Styles sent.
        clearStyles.clear();
        onClose();
      }}
    />
  );
}
