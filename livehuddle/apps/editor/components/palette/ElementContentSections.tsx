import type { Element } from '@livehuddle/document';
import { ContextMenuDivider } from '@liveworkspace/workbench/components/palette/ContextMenu';
import { ImageGlyph, LinkMenuIcon, RemoveIconGlyph } from '@/components/palette/context-menu-icons';
import { MenuAccordionSection } from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { MenuTile, MenuTileGrid } from '@liveworkspace/workbench/components/primitives/MenuTiles';
import { ImageCreditRow } from '@/components/palette/ImageCreditRow';
import type { EditorContextMenuProps } from './EditorContextMenu.types';
import type { useContextMenuScaffold } from './useContextMenuScaffold';

type Scaffold = ReturnType<typeof useContextMenuScaffold>;

// The lower, content / metadata sections of the single-element context menu:
// Image and Link. Assign Action, Comments, Link and Note left livehuddle, and with them the
// quick bar (docs/specs/008-canvas/element-menu-quick-bar.md). Split out of EditorContextMenu;
// shares the accordion + colour scaffolding via props so only one section
// opens at a time across the whole menu.
type ElementContentSectionsProps = {
  props: EditorContextMenuProps;
  target: Element;
  onClose: () => void;
  hasImage: boolean;
  hasLink: boolean;
  sectionProps: Scaffold['sectionProps'];
};

export function ElementContentSections({
  props,
  target,
  onClose,
  hasImage,
  hasLink,
  sectionProps,
}: ElementContentSectionsProps) {
  return (
    <>
      {/* Image — pick / change / clear the bitmap (docs/specs/009-elements/images.md). */}
      {target.type === 'image' ? (
        <MenuAccordionSection title="Image" icon={<ImageGlyph />} {...sectionProps('image')}>
          {hasImage ? (
            <MenuTileGrid cols={2}>
              <MenuTile
                icon={<ImageGlyph />}
                label="Change Image"
                onClick={() => {
                  props.onOpenImagePicker(target.id);
                  onClose();
                }}
              />
              <MenuTile
                icon={<RemoveIconGlyph />}
                label="Remove Image"
                onClick={() => {
                  props.onRemoveImage(target.id);
                  onClose();
                }}
              />
            </MenuTileGrid>
          ) : (
            <div className="px-2 py-1.5">
              <MenuTile
                icon={<ImageGlyph />}
                label="Select Image"
                onClick={() => {
                  props.onOpenImagePicker(target.id);
                  onClose();
                }}
              />
            </div>
          )}
          {target.credit ? (
            <>
              <ContextMenuDivider />
              <ImageCreditRow credit={target.credit} />
            </>
          ) : null}
        </MenuAccordionSection>
      ) : null}
      {/* Link: set / change / remove a link-card's destination (docs/specs/009-elements/link-cards.md). */}
      {target.type === 'link-card' ? (
        <MenuAccordionSection title="Link" icon={<LinkMenuIcon />} {...sectionProps('link')}>
          {hasLink ? (
            <MenuTileGrid cols={2}>
              <MenuTile
                icon={<LinkMenuIcon />}
                label="Change Link"
                onClick={() => {
                  props.onLinkElement(target.id);
                  onClose();
                }}
              />
              <MenuTile
                icon={<RemoveIconGlyph />}
                label="Remove Link"
                onClick={() => {
                  props.onRemoveLink();
                  onClose();
                }}
              />
            </MenuTileGrid>
          ) : (
            <div className="px-2 py-1.5">
              <MenuTile
                icon={<LinkMenuIcon />}
                label="Set Link"
                onClick={() => {
                  props.onLinkElement(target.id);
                  onClose();
                }}
              />
            </div>
          )}
        </MenuAccordionSection>
      ) : null}
    </>
  );
}
