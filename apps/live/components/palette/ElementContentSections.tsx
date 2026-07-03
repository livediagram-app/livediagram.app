import { isBoxed, type Element } from '@livediagram/diagram';
import { ContextMenuDivider } from '@/components/palette/ContextMenu';
import {
  BoldIcon,
  ItalicIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from '@/components/palette/palette-icons';
import {
  ActionMenuIcon,
  CommentMenuIcon,
  ImageGlyph,
  LinkMenuIcon,
  NoteMenuIcon,
  RemoveIconGlyph,
  TableGlyph,
  TextGlyph,
} from '@/components/palette/context-menu-icons';
import {
  MenuAccordionSection,
  MenuGroupSeparator,
  MenuTile,
  MenuTileGrid,
} from '@/components/primitives/PortalMenu';
import {
  ColourRow,
  MenuToggleRow,
  TextSizeTiles,
  TextToggle,
} from '@/components/palette/context-menu-rows';
import type { EditorContextMenuProps } from './EditorContextMenu.types';
import type { useContextMenuScaffold } from './useContextMenuScaffold';

type Scaffold = ReturnType<typeof useContextMenuScaffold>;

// The lower, content / metadata sections of the single-element context menu:
// Text (labelled arrow / table cells), Image, Table structure, Link, and the
// collaboration band's two categories (spec/68) — Collaborate (Assign Action
// + Comments) and Resources (Link + Note). Split out of EditorContextMenu;
// shares the accordion + colour scaffolding via props so only one section
// opens at a time across the whole menu.
type ElementContentSectionsProps = {
  props: EditorContextMenuProps;
  target: Element;
  onClose: () => void;
  hasImage: boolean;
  hasLink: boolean;
  showCollaborateGroup: boolean;
  sectionProps: Scaffold['sectionProps'];
  colorProps: Scaffold['colorProps'];
  textColorHandlers: Scaffold['textColorHandlers'];
};

export function ElementContentSections({
  props,
  target,
  onClose,
  hasImage,
  hasLink,
  showCollaborateGroup,
  sectionProps,
  colorProps,
  textColorHandlers,
}: ElementContentSectionsProps) {
  const boxed = isBoxed(target);
  return (
    <>
      {/* Text — whole-element label formatting for a labelled arrow, or
            every cell of a table (other boxed elements format via the inline
            rich-text toolbar instead). */}
      {(target.type === 'arrow' && target.label) || target.type === 'table' ? (
        <MenuAccordionSection title="Text" icon={<TextGlyph />} {...sectionProps('text')}>
          {target.type === 'table' ? (
            <p className="px-3 pt-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
              Applies to every cell.
            </p>
          ) : null}
          <div className="flex gap-1 px-2 py-1.5">
            <TextToggle active={!!target.textBold} label="Bold" onClick={props.onToggleTextBold}>
              <BoldIcon />
            </TextToggle>
            <TextToggle
              active={!!target.textItalic}
              label="Italic"
              onClick={props.onToggleTextItalic}
            >
              <ItalicIcon />
            </TextToggle>
            <TextToggle
              active={!!target.textUnderline}
              label="Underline"
              onClick={props.onToggleTextUnderline}
            >
              <UnderlineIcon />
            </TextToggle>
            <TextToggle
              active={!!target.textStrikethrough}
              label="Strikethrough"
              onClick={props.onToggleTextStrikethrough}
            >
              <StrikethroughIcon />
            </TextToggle>
          </div>
          <p className="px-3 pb-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
            Size
          </p>
          <TextSizeTiles
            current={target.textSize ?? 'sm'}
            onSet={props.onSetTextSize}
            onPreview={props.onPreviewTextSize}
            onPreviewEnd={props.onPreviewStyleEnd}
          />
          <ContextMenuDivider />
          <ColourRow
            label="Colour"
            value={target.textColor ?? '#0f172a'}
            {...textColorHandlers}
            {...colorProps('text')}
            presets={props.presetColors}
          />
        </MenuAccordionSection>
      ) : null}
      {/* Image — pick / change / clear the bitmap (spec/19). */}
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
        </MenuAccordionSection>
      ) : null}
      {/* Table — header row / column + zebra. */}
      {target.type === 'table' ? (
        <MenuAccordionSection title="Table" icon={<TableGlyph />} {...sectionProps('table')}>
          <MenuToggleRow
            label="Header row"
            description="Style the first row as a header."
            checked={target.headerRow ?? false}
            onToggle={props.onToggleTableHeaderRow}
          />
          <ContextMenuDivider />
          <MenuToggleRow
            label="Header column"
            description="Style the first column as a header."
            checked={target.headerColumn ?? false}
            onToggle={props.onToggleTableHeaderColumn}
          />
          <ContextMenuDivider />
          <MenuToggleRow
            label="Zebra striping"
            description="Tint alternate body rows."
            checked={target.zebra ?? false}
            onToggle={props.onToggleTableZebra}
          />
        </MenuAccordionSection>
      ) : null}
      {/* Link — set / change / remove a link-card's destination (spec/40). */}
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
      {/* ── Collaboration group (spec/68): two categories — Collaborate
            (the people tiles: Assign Action + Comments) then Resources
            (the attached-material tiles: Link + Note). Both boxed-only:
            arrows can't be linked, noted, commented on, or assigned. */}
      {showCollaborateGroup ? <MenuGroupSeparator /> : null}
      {boxed ? (
        <MenuAccordionSection
          title="Collaborate"
          icon={<CommentMenuIcon />}
          {...sectionProps('collaborate')}
        >
          {/* Assign Action shows for everyone: signed-out users can
                assign to themselves (spec/68 §2). */}
          <MenuTileGrid cols={2}>
            <MenuTile
              icon={<ActionMenuIcon />}
              label={target.action ? 'View Action' : 'Assign Action'}
              onClick={() => {
                props.onAssignAction(target.id);
                onClose();
              }}
            />
            <MenuTile
              icon={<CommentMenuIcon />}
              label="Comments"
              onClick={() => {
                props.onOpenComments(target.id);
                onClose();
              }}
            />
          </MenuTileGrid>
        </MenuAccordionSection>
      ) : null}
      {boxed ? (
        <MenuAccordionSection
          title="Resources"
          icon={<LinkMenuIcon />}
          {...sectionProps('resources')}
        >
          {/* Link-cards have their own Link category (set / change / remove),
                so the generic "Add Link" is dropped here for them. */}
          {target.type !== 'link-card' ? (
            <MenuTileGrid cols={2}>
              <MenuTile
                icon={<LinkMenuIcon />}
                label={target.link ? 'Edit Link' : 'Add Link'}
                onClick={() => {
                  props.onLinkElement(target.id);
                  onClose();
                }}
              />
              <MenuTile
                icon={<NoteMenuIcon />}
                label={target.note ? 'Edit Note' : 'Add Note'}
                onClick={() => {
                  props.onOpenNote(target.id);
                  onClose();
                }}
              />
            </MenuTileGrid>
          ) : (
            <div className="px-2 py-1.5">
              <MenuTile
                icon={<NoteMenuIcon />}
                label={target.note ? 'Edit Note' : 'Add Note'}
                onClick={() => {
                  props.onOpenNote(target.id);
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
