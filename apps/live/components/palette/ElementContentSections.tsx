import type { Element } from '@liveplanner/document';
import { ContextMenuDivider } from '@/components/palette/ContextMenu';
import {
  BoldIcon,
  ItalicIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from '@/components/palette/palette-icons';
import {
  ImageGlyph,
  LinkMenuIcon,
  RemoveIconGlyph,
  FillColourIcon,
  TableGlyph,
  TextColourIcon,
  TextGlyph,
} from '@/components/palette/context-menu-icons';
import { MenuAccordionSection } from '@/components/primitives/PortalMenu';
import { MenuTile, MenuTileGrid } from '@/components/primitives/MenuTiles';
import { ColourRow, MenuToggleRow, TextToggle } from '@/components/palette/context-menu-rows';
import { presetPxFor, TextSizeControl } from '@/components/palette/TextSizeControl';
import type { EditorContextMenuProps } from './EditorContextMenu.types';
import type { useContextMenuScaffold } from './useContextMenuScaffold';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { inkSwatch, shownColour } from '@/components/palette/ink-row';

type Scaffold = ReturnType<typeof useContextMenuScaffold>;

// The lower, content / metadata sections of the single-element context menu:
// Text (labelled arrow / table cells), Image, Table structure and Link. Assign Action, Comments, Link and Note are on
// the menu's quick bar above every category (ElementMenuQuickBar). Split out of EditorContextMenu;
// shares the accordion + colour scaffolding via props so only one section
// opens at a time across the whole menu.
type ElementContentSectionsProps = {
  props: EditorContextMenuProps;
  target: Element;
  onClose: () => void;
  hasLink: boolean;
  sectionProps: Scaffold['sectionProps'];
  colorProps: Scaffold['colorProps'];
  textColorHandlers: Scaffold['textColorHandlers'];
  labelFillHandlers: Scaffold['labelFillHandlers'];
};

export function ElementContentSections({
  props,
  target,
  onClose,
  hasLink,
  sectionProps,
  colorProps,
  textColorHandlers,
  labelFillHandlers,
}: ElementContentSectionsProps) {
  const surface = useCanvasSurface();
  return (
    <>
      {/* Caption / Text: whole-element label formatting for a labelled
            arrow, or every cell of a table (other boxed elements format via
            the inline rich-text toolbar instead). An arrow's is called
            Caption, because that is what the words beside a line are, and
            because "Text" on an arrow reads as the line's own label field
            rather than how it is painted. */}
      {(target.type === 'arrow' && target.label) || target.type === 'table' ? (
        <MenuAccordionSection
          title={target.type === 'arrow' ? 'Caption' : 'Text'}
          icon={<TextGlyph />}
          {...sectionProps('text')}
        >
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
          <TextSizeControl
            current={target.textSize ?? 'sm'}
            presetPx={presetPxFor(target.type)}
            onSet={props.onSetTextSize}
            onPreview={props.onPreviewTextSize}
            onPreviewEnd={props.onPreviewStyleEnd}
          />
          <ContextMenuDivider />
          <ColourRow
            label={target.type === 'arrow' ? 'Text' : 'Colour'}
            icon={<TextColourIcon />}
            value={shownColour(target, 'text', surface, '#0f172a')}
            ink={inkSwatch(target, 'text', surface)}
            {...textColorHandlers}
            {...colorProps('text')}
            {...props.colourPalette}
          />
          {/* The plate behind the caption. Transparent by default, which is
              how an arrow's label has always drawn; a colour here is for a
              caption that has to stay readable over its own line or a busy
              backdrop. */}
          {target.type === 'arrow' ? (
            <ColourRow
              label="Background"
              tone="soft"
              icon={<FillColourIcon />}
              value={target.labelFill ?? 'transparent'}
              {...labelFillHandlers}
              {...colorProps('caption-bg')}
              {...props.colourPalette}
            />
          ) : null}
        </MenuAccordionSection>
      ) : null}
      {/* Image — its caption card (there is no picture to pick). */}
      {target.type === 'image' ? (
        <MenuAccordionSection title="Image" icon={<ImageGlyph />} {...sectionProps('image')}>
          {/* The hero's caption card (docs/specs/009-elements/web-components-and-no-groups.md): any image can carry one. */}
          <MenuToggleRow
            label="Caption Card"
            description="A title and a line of text over the image."
            checked={!!target.heroCaption}
            onToggle={() => props.onSetHeroCaption(!target.heroCaption)}
          />
        </MenuAccordionSection>
      ) : null}
      {/* Table — header row / column + zebra. */}
      {target.type === 'table' ? (
        <MenuAccordionSection title="Table" icon={<TableGlyph />} {...sectionProps('table')}>
          <MenuToggleRow
            label="Header Row"
            description="Style the first row as a header."
            checked={target.headerRow ?? false}
            onToggle={props.onToggleTableHeaderRow}
          />
          <ContextMenuDivider />
          <MenuToggleRow
            label="Header Column"
            description="Style the first column as a header."
            checked={target.headerColumn ?? false}
            onToggle={props.onToggleTableHeaderColumn}
          />
          <ContextMenuDivider />
          <MenuToggleRow
            label="Zebra Striping"
            description="Tint alternate body rows."
            checked={target.zebra ?? false}
            onToggle={props.onToggleTableZebra}
          />
        </MenuAccordionSection>
      ) : null}
      {/* Link — set / change / remove a link-card's destination (docs/specs/009-elements/link-cards.md), or
          a video's YouTube URL (docs/specs/009-elements/youtube-video.md). Both keep their URL in `link`, so
          both use this one section rather than a second URL editor. */}
      {target.type === 'link-card' || target.type === 'video' ? (
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
