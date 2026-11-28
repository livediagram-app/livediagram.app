'use client';

// Right-click context menu for the editor, lifted out of
// editor-page.tsx. Renders one of two menus depending on what was
// clicked: a single-element menu (Size, the element's own section, an
// image's or a link card's content) or a whole-selection 'multi' menu.
// No Arrange, Rotation or Appearance (docs/specs/002-project-scope/
// not-in-livehuddle.md "Element looks, layers, opacity and rotation"). The canvas (empty-space)
// right-click opens the tab menu with its canvas sections folded in,
// rendered by the TabBar — not here. Duplicate lives in the selection
// toolbar (SelectionPopover), not here.
//
// Purely presentational: every action is a callback prop, and each
// item closes the menu after firing (the close-then-act pattern the
// inline version used). The page owns the open/closed state + the
// handlers; this component only decides which items to show.

import { ElementRowsDialog } from '@liveworkspace/workbench/components/dialogs/ElementRowsDialog';
import { elementSettingsHeroArt } from '@liveworkspace/ui/dialog-hero-art/element-settings';
import { elementKindLabel, isPoster } from '@livehuddle/document';
import {
  isFixedSizeElement,
  isBoxed,
  isRetiredElement,
  isSelfDrawingShape,
} from '@livehuddle/document';
import { ContextMenu } from '@liveworkspace/workbench/components/palette/ContextMenu';
import { SizeMenuIcon } from '@liveworkspace/workbench/components/palette/context-menu-icons';
import {
  MenuAccordionSection,
  MenuGroupSeparator,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { SizeSection } from '@liveworkspace/workbench/components/palette/SizeSection';

import type { EditorContextMenuProps } from './EditorContextMenu.types';
import { useContextMenuScaffold } from './useContextMenuScaffold';
import { ElementContentSections } from './ElementContentSections';
import { ElementDataSections, hasOwnSection } from './ElementDataSections';
import { MultiSelectionContextMenu } from './MultiSelectionContextMenu';
import { useViewportHeight } from '@liveworkspace/workbench/hooks/ui/useViewportHeight';

// Cursor position + which menu to show. `element` carries the clicked
// element id; `canvas` is the empty-canvas right-click. Exported so
// the page can type its own context-menu state against it.
export type { EditorContextMenuState } from './EditorContextMenu.types';

export function EditorContextMenu(props: EditorContextMenuProps) {
  const { menu, elements, onClose } = props;
  const position = { x: menu.x, y: menu.y };
  // Grow UPWARD when the menu is opened in the bottom fifth of the
  // viewport, so the tall collapsible-category menu opens above the
  // cursor instead of running off-screen — matching the tab menu.
  const viewportHeight = useViewportHeight();
  const anchorBottom = menu.y > viewportHeight * 0.8;
  // The one-open-at-a-time accordion, shared with the multi-selection branch.
  const { sectionProps } = useContextMenuScaffold();

  if (menu.mode === 'multi') {
    return (
      <MultiSelectionContextMenu
        props={props}
        position={position}
        onClose={onClose}
        anchorBottom={anchorBottom}
      />
    );
  }

  if (menu.mode === 'element') {
    const target = elements.find((el) => el.id === menu.elementId);
    if (!target) return null;
    const boxed = isBoxed(target);
    const isIcon = target.type === 'shape' && target.shape === 'icon';
    const hasImage = target.type === 'image' && target.imageId != null;
    const hasLink = target.link != null;
    // Regular shapes (not the dedicated icon glyph, not a self-drawing data
    // shape which carries its own data) can reset to their kind's aspect ratio. The diagram shapes they once morphed
    // between are retired (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 5).
    // A retired element (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements") keeps its stored look
    // and kind and has no settings or menu section of its own.
    const retired = isRetiredElement(target);
    const morphable =
      target.type === 'shape' &&
      !retired &&
      !isIcon &&
      // Every self-drawing kind carries its own data (progress / rail /
      // rating / charts / code block / checklist), so none of them morph.
      !isSelfDrawingShape(target.shape);
    // Size, then the element's own section, then the content group (Image / Link) behind a divider.
    // A Poster's Picture section is an Editor's (docs/specs/009-elements/poster.md).
    const posterMenu = isPoster(target) && !!props.onChoosePosterPicture;
    const showContentGroup = target.type === 'image' || target.type === 'link-card' || posterMenu;
    const showSize = boxed && !isFixedSizeElement(target);
    const showOwn = !retired && hasOwnSection(props, target);
    // Its own settings, opened from the menu's row named for it: the same sections in a dialog, laid open
    // (canvas-and-palette.md "An element's own settings open in a dialog"). The menu is not drawn under it.
    if (menu.mode === 'element' && menu.tools) {
      return (
        <ElementRowsDialog
          art={elementSettingsHeroArt}
          title={elementKindLabel(target)}
          subtitle="What only this kind of element has."
          onClose={onClose}
        >
          <div data-context-menu="" className="-mx-6 -my-4 text-sm">
            <ElementDataSections
              props={props}
              target={target}
              sectionProps={sectionProps}
              surface="dialog"
            />
          </div>
        </ElementRowsDialog>
      );
    }
    // A menu with nothing in it does not open (docs/specs/002-project-scope/not-in-livehuddle.md "Format Painter and
    // Clear Styles").
    if (!showSize && !showOwn && !showContentGroup) return null;
    return (
      <ContextMenu
        position={position}
        label="Element menu"
        onClose={onClose}
        flush
        anchorBottom={anchorBottom}
      >
        {/* Size — the exact box (docs/specs/008-canvas/element-size.md). Gathers the three controls that
            all answer "how big is this": the width / height boxes, the aspect
            lock (which lived in Layer) and the reset (which lived in Shape,
            so it only appeared for morphable kinds). */}
        {/* Fixed-size elements (docs/specs/009-elements/mode-button.md buttons) have no size to edit: offering the boxes would advertise
            a resize the drag paths deliberately ignore. */}
        {showSize ? (
          <MenuAccordionSection title="Size" icon={<SizeMenuIcon />} {...sectionProps('size')}>
            <SizeSection
              width={(target as { width: number }).width}
              height={(target as { height: number }).height}
              aspectLocked={!!(target as { aspectLocked?: boolean }).aspectLocked}
              onSetSize={props.onSetSize}
              onToggleAspectLock={props.onToggleAspectLock}
              onResetAspectRatio={() => {
                props.onResetAspectRatio();
                onClose();
              }}
              showReset={morphable}
            />
          </MenuAccordionSection>
        ) : null}
        {/* The element's own section (Desk, Room, Portal and the rest). */}
        {showOwn ? (
          <ElementDataSections props={props} target={target} sectionProps={sectionProps} />
        ) : null}
        {showContentGroup ? <MenuGroupSeparator /> : null}
        <ElementContentSections
          props={props}
          target={target}
          onClose={onClose}
          hasImage={hasImage}
          hasLink={hasLink}
          sectionProps={sectionProps}
        />
      </ContextMenu>
    );
  }

  // The canvas right-click menu moved to the tab menu (TabBar) so it reuses
  // every tab handler with the canvas sections folded in; this component now
  // only renders the element + multi menus. `menu.mode === 'canvas'` never
  // reaches here (the page routes it to the TabBar), so fall through to null.
  return null;
}
