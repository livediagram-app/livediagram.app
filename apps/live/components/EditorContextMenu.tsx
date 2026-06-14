'use client';

// Right-click context menu for the editor, lifted out of
// editor-page.tsx. Renders one of two menus depending on what was
// clicked: an element-scoped menu (link / layer order / note /
// comment) or a canvas-scoped menu (change theme / canvas,
// auto-align, add shape / sticky). Duplicate lives in the selection
// toolbar (SelectionPopover), not here.
//
// Purely presentational: every action is a callback prop, and each
// item closes the menu after firing (the close-then-act pattern the
// inline version used). The page owns the open/closed state + the
// handlers; this component only decides which items to show.

import { useState, type ReactNode } from 'react';
import {
  arrowheadShapeOf,
  arrowheadSizeOf,
  arrowStyleOf,
  arrowThicknessOf,
  defaultFillColor,
  defaultStrokeColor,
  defaultTextColor,
  isBoxed,
  supportsBorderControls,
  supportsBorderRadius,
  supportsColours,
  timerDisplayMs,
  type ArrowEnds,
  type ArrowheadShape,
  type ArrowheadSize,
  type ArrowStyle,
  type ArrowThickness,
  type BorderRadius,
  type BorderStroke,
  type BorderStyle,
  type BoxedElement,
  type Element,
  type ShapeKind,
  type TabTimer,
  type TabVote,
  type TextSize,
  type TimerMode,
} from '@livediagram/diagram';
import { ArrowLineControls, ArrowPointerControls } from '@/components/arrow-controls';
import { ContextMenu, ContextMenuDivider } from '@/components/ContextMenu';
import { SizeButton, ToggleSwitch } from '@/components/palette-controls';
import {
  BoldIcon,
  BorderRadiusIcon,
  BorderStrokeIcon,
  BorderStyleIcon,
  DotsIcon,
  FileExportIcon,
  ItalicIcon,
  ScaleIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from '@/components/palette-icons';
import { TrashIcon } from '@/components/explorer-icons';
import {
  AnnotationMenuIcon,
  AutoAlignIcon,
  CanvasMenuIcon,
  CommentMenuIcon,
  LayerDownIcon,
  LayerUpIcon,
  LinkMenuIcon,
  NoteMenuIcon,
  PaletteMenuIcon,
  PencilMenuIcon,
  SquareMenuIcon,
  StickyMenuIcon,
} from '@/components/context-menu-icons';
import { MenuAccordionSection, MenuTile, MenuTileGrid } from '@/components/PortalMenu';
import { ShapeIcon } from '@/components/shape-icon';

// A curated subset of the most common shapes offered for in-place morphing
// in the context menu's Shape category (the full set lived in the old panel).
const COMMON_SHAPES: ShapeKind[] = [
  'square',
  'circle',
  'diamond',
  'stadium',
  'parallelogram',
  'hexagon',
  'triangle',
  'cylinder',
];

// Fixed rotation snap points offered in the context menu's Rotation
// category. 0 doubles as "reset to upright". The freeform rotate handle
// still covers arbitrary angles; these are the common ones.
const ROTATION_ANGLES = [0, 45, 90, 135, 180, 225, 270, 315] as const;

// Cursor position + which menu to show. `element` carries the clicked
// element id; `canvas` is the empty-canvas right-click. Exported so
// the page can type its own context-menu state against it.
export type EditorContextMenuState =
  | { mode: 'element'; elementId: string; x: number; y: number }
  // A whole multi-selection or group was right-clicked — actions apply to
  // everything selected.
  | { mode: 'multi'; x: number; y: number }
  // `openUp` grows the menu upward from y (for the footer canvas-menu button,
  // so it opens above the footer rather than over it).
  | { mode: 'canvas'; x: number; y: number; openUp?: boolean };

type EditorContextMenuProps = {
  menu: EditorContextMenuState;
  // The active tab's elements — used to resolve the clicked element
  // (for the element menu) and read its link / note state.
  elements: Element[];
  onClose: () => void;
  // Open the link picker for the element, optionally pre-selecting a mode
  // (webpage / tab / diagram) so the modal lands on the right tab.
  onLinkElement: (elementId: string, mode?: 'url' | 'tab' | 'diagram') => void;
  // Remove an inline icon from the element. Only surfaced when the
  // clicked element actually carries one (a non-'icon' shape with iconId).
  onRemoveIcon: (elementId: string) => void;
  // Image element actions (spec/19): open the picker (select / change) and
  // clear the picked image back to a placeholder.
  onOpenImagePicker: (elementId: string) => void;
  onRemoveImage: (elementId: string) => void;
  // Clear the link off the selected element (spec/40 link-card "Remove Link").
  onRemoveLink: () => void;
  onBringToFront: () => void;
  onSendToBack: () => void;
  // Toggle aspect-ratio lock + set opacity on the clicked element (boxed
  // only). Read the current values off the target below.
  onToggleAspectLock: () => void;
  onSetOpacity: (opacity: number) => void;
  onSetTextColor: (color: string) => void;
  onSetFillColor: (color: string) => void;
  onSetStrokeColor: (color: string) => void;
  onSetBorderStroke: (value: BorderStroke) => void;
  onSetBorderStyle: (value: BorderStyle) => void;
  onSetBorderRadius: (value: BorderRadius) => void;
  onResetColors: () => void;
  // Whole-element text formatting — surfaced for arrows that carry a label
  // (boxed elements format via the inline rich-text toolbar instead).
  onToggleTextBold: () => void;
  onToggleTextItalic: () => void;
  onToggleTextUnderline: () => void;
  onToggleTextStrikethrough: () => void;
  onSetTextSize: (size: TextSize) => void;
  // Arrow Line + Pointer controls (spec/09), surfaced for arrows via the
  // shared ArrowLine / Pointer controls.
  onSetArrowThickness: (v: ArrowThickness) => void;
  onSetArrowStyle: (v: ArrowStyle) => void;
  onSetArrowStrokeStyle: (v: BorderStyle) => void;
  onSetArrowEnds: (v: ArrowEnds) => void;
  onSetArrowheadSize: (v: ArrowheadSize) => void;
  onSetArrowheadShape: (v: ArrowheadShape) => void;
  // Morph a shape element to another kind in place (preserving size/colour).
  onSetShapeKind: (kind: ShapeKind) => void;
  // Rotate the selected element to a fixed angle (degrees clockwise).
  onSetRotation: (deg: number) => void;
  // Preset colour swatches for the colour pickers, derived from the active
  // theme so the offered presets match it.
  presetColors: string[];
  // Table structure toggles (header row / column, zebra) for the Table
  // category.
  onToggleTableHeaderRow: () => void;
  onToggleTableHeaderColumn: () => void;
  onToggleTableZebra: () => void;
  // Re-place a shape's inline icon (reuses the drop handler: same iconId,
  // new side).
  onSetIconPosition: (
    elementId: string,
    iconId: string,
    position: 'left' | 'right' | 'above' | 'below',
  ) => void;
  onOpenNote: (elementId: string) => void;
  onOpenComments: (elementId: string) => void;
  onChangeTheme: () => void;
  onChangeCanvas: () => void;
  onAutoAlign: () => void;
  onAddShape: (kind: ShapeKind) => void;
  onAddSticky: () => void;
  onDrawPencil: () => void;
  onAddAnnotation: () => void;
  // Whole-selection actions for the 'multi' menu (a marquee multi-selection
  // or a group). The page wires these to the right handlers (multi vs group)
  // + reports the count, group state, and lock state.
  selectionCount: number;
  selectionIsGroup: boolean;
  selectionLocked: boolean;
  onDuplicateSelection: () => void;
  onDeleteSelection: () => void;
  onToggleLockSelection: () => void;
  onExportSelection: () => void;
  onGroupSelection: () => void;
  onUngroupSelection: () => void;
  // Session tools (spec/39) for the canvas menu's Session category. The full
  // facilitator surface (timer mode + duration, pause/resume/reset, vote
  // dots-per-person + reveal) lives here now, mirroring the old tab editor.
  timer: TabTimer | null;
  vote: TabVote | null;
  onStartTimer: (mode: TimerMode, durationMs?: number) => void;
  onPauseTimer: () => void;
  onResumeTimer: () => void;
  onResetTimer: () => void;
  onClearTimer: () => void;
  onStartVote: (votesPerPerson: number) => void;
  onEndVote: () => void;
  onRevealVote: () => void;
  onClearVote: () => void;
};

export function EditorContextMenu(props: EditorContextMenuProps) {
  const { menu, elements, onClose } = props;
  const position = { x: menu.x, y: menu.y };
  // Which collapsible section is open in the element menu — at most one at a
  // time (null = all collapsed). An accordion the user can only open one of.
  const [openSection, setOpenSection] = useState<string | null>(null);
  const sectionProps = (id: string) => ({
    open: openSection === id,
    onToggle: () => setOpenSection((s) => (s === id ? null : id)),
  });
  // Which colour row's inline palette is open (text / background / border) —
  // at most one, toggled by re-clicking the row so it never sticks open.
  const [openColor, setOpenColor] = useState<string | null>(null);
  const colorProps = (id: string) => ({
    open: openColor === id,
    onToggle: () => setOpenColor((c) => (c === id ? null : id)),
  });
  // Session-tool pickers (spec/39): the chosen timer mode + countdown length
  // and the votes-per-person budget, local until the facilitator hits Start
  // (mirrors the old tab editor's Session accordion).
  const [timerMode, setTimerMode] = useState<TimerMode>('countdown');
  const [durationMin, setDurationMin] = useState(5);
  const [votesPerPerson, setVotesPerPerson] = useState(3);

  if (menu.mode === 'multi') {
    const noun = props.selectionIsGroup ? 'group' : `${props.selectionCount} elements`;
    return (
      <ContextMenu position={position} onClose={onClose} flush>
        <MenuTileGrid cols={2}>
          <MenuTile
            icon={<DuplicateMenuIcon />}
            label="Duplicate"
            onClick={() => {
              props.onDuplicateSelection();
              onClose();
            }}
          />
          {props.selectionIsGroup ? (
            <MenuTile
              icon={<UngroupMenuIcon />}
              label="Ungroup"
              onClick={() => {
                props.onUngroupSelection();
                onClose();
              }}
            />
          ) : (
            <MenuTile
              icon={<GroupMenuIcon />}
              label="Group"
              onClick={() => {
                props.onGroupSelection();
                onClose();
              }}
            />
          )}
          <MenuTile
            icon={<LockMenuIcon />}
            label={props.selectionLocked ? 'Unlock' : 'Lock'}
            onClick={() => {
              props.onToggleLockSelection();
              onClose();
            }}
          />
          <MenuTile
            icon={<FileExportIcon />}
            label="Export"
            onClick={() => {
              props.onExportSelection();
              onClose();
            }}
          />
        </MenuTileGrid>
        <ContextMenuDivider />
        <div className="px-2 py-1.5">
          <MenuTile
            icon={<TrashIcon />}
            label={`Delete ${noun}`}
            danger
            disabled={props.selectionLocked}
            onClick={() => {
              props.onDeleteSelection();
              onClose();
            }}
          />
        </div>
      </ContextMenu>
    );
  }

  if (menu.mode === 'element') {
    const target = elements.find((el) => el.id === menu.elementId);
    if (!target) return null;
    const boxed = isBoxed(target);
    const isIcon = target.type === 'shape' && target.shape === 'icon';
    // Border + colour controls apply to shapes / freehand / tables, including
    // standalone icons — their wrapper paints fillColor as the box background
    // and strokeColor as the border just like a square (the icon glyph sits on
    // top). A brand icon's glyph stays fixed-colour, but its box background /
    // border are the user's to set, so we offer the same controls.
    const borderable = supportsBorderControls(target);
    const borderStrokeVal: BorderStroke =
      (target as { strokeWidth?: BorderStroke }).strokeWidth ??
      (target.type === 'table' ? 'thin' : 'medium');
    const borderStyleVal: BorderStyle =
      (target as { strokeStyle?: BorderStyle }).strokeStyle ?? 'solid';
    const borderRadiusVal: BorderRadius =
      (target as { borderRadius?: BorderRadius }).borderRadius ?? 'sm';
    // A regular shape carrying an inline icon (drag-an-icon-onto-it
    // feature, spec/09) gets a "Remove icon" entry; the dedicated 'icon'
    // shape is its own glyph and excluded.
    const hasInlineIcon =
      target.type === 'shape' && target.shape !== 'icon' && target.iconId !== undefined;
    const hasImage = target.type === 'image' && target.imageId != null;
    const hasLink = target.link != null;
    // Regular shapes (not the dedicated icon glyph, not a frame container)
    // can morph to another common kind in place.
    const morphable = target.type === 'shape' && !isIcon && target.shape !== 'frame';
    return (
      <ContextMenu position={position} onClose={onClose} flush>
        {/* Shape — morph to another common kind, preserving size + colour. */}
        {morphable ? (
          <MenuAccordionSection title="Shape" icon={<SquareMenuIcon />} {...sectionProps('shape')}>
            <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
              {COMMON_SHAPES.map((kind) => (
                <SizeButton
                  key={kind}
                  active={target.type === 'shape' && target.shape === kind}
                  onClick={() => props.onSetShapeKind(kind)}
                >
                  <ShapeIcon kind={kind} />
                </SizeButton>
              ))}
            </div>
          </MenuAccordionSection>
        ) : null}
        {/* Rotation — fixed snap angles. Each tile previews the orientation
            (an upright marker rotated by the angle) so the effect is legible
            before clicking; 0° resets to upright. */}
        {boxed ? (
          <MenuAccordionSection
            title="Rotation"
            icon={<RotationGlyph deg={45} />}
            {...sectionProps('rotation')}
          >
            <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
              {ROTATION_ANGLES.map((deg) => (
                <SizeButton
                  key={deg}
                  active={((target as { rotation?: number }).rotation ?? 0) % 360 === deg}
                  onClick={() => props.onSetRotation(deg)}
                >
                  <span className="flex flex-col items-center gap-0.5">
                    <RotationGlyph deg={deg} />
                    <span className="text-[9px] leading-none tabular-nums">{deg}°</span>
                  </span>
                </SizeButton>
              ))}
            </div>
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
        {/* Icon — re-place or remove a shape's inline icon. */}
        {hasInlineIcon ? (
          <MenuAccordionSection title="Icon" icon={<IconCategoryGlyph />} {...sectionProps('icon')}>
            <p className="px-3 pb-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
              Icon position
            </p>
            <IconPositionGrid
              current={(target as { iconPosition?: string }).iconPosition ?? 'left'}
              onPick={(pos) =>
                props.onSetIconPosition(
                  target.id,
                  (target as { iconId?: string }).iconId ?? '',
                  pos,
                )
              }
            />
            <ContextMenuDivider />
            <div className="px-2 py-1.5">
              <MenuTile
                icon={<RemoveIconGlyph />}
                label="Remove icon"
                onClick={() => {
                  props.onRemoveIcon(target.id);
                  onClose();
                }}
              />
            </div>
          </MenuAccordionSection>
        ) : null}
        {/* Line + Pointer — arrow stroke + arrowhead controls (shared
            ArrowLine/PointerControls). */}
        {target.type === 'arrow' ? (
          <>
            <MenuAccordionSection title="Line" icon={<LineGlyph />} {...sectionProps('line')}>
              <div className="px-3 py-1.5">
                <ArrowLineControls
                  thickness={arrowThicknessOf(target)}
                  style={arrowStyleOf(target)}
                  strokeStyle={target.strokeStyle ?? 'solid'}
                  onSetThickness={props.onSetArrowThickness}
                  onSetStyle={props.onSetArrowStyle}
                  onSetStrokeStyle={props.onSetArrowStrokeStyle}
                />
              </div>
            </MenuAccordionSection>
            <MenuAccordionSection
              title="Pointer"
              icon={<PointerGlyph />}
              {...sectionProps('pointer')}
            >
              <div className="px-3 py-1.5">
                <ArrowPointerControls
                  ends={target.arrowEnds ?? 'to'}
                  headSize={arrowheadSizeOf(target)}
                  headShape={arrowheadShapeOf(target)}
                  onSetEnds={props.onSetArrowEnds}
                  onSetHeadSize={props.onSetArrowheadSize}
                  onSetHeadShape={props.onSetArrowheadShape}
                />
              </div>
            </MenuAccordionSection>
          </>
        ) : null}
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
            <div className="grid grid-cols-4 gap-1 px-2 pb-1.5">
              {(
                [
                  ['scale', <ScaleIcon key="s" />],
                  ['sm', <DotsIcon key="1" count={1} />],
                  ['md', <DotsIcon key="2" count={2} />],
                  ['lg', <DotsIcon key="3" count={3} />],
                ] as const
              ).map(([size, glyph]) => (
                <SizeButton
                  key={size}
                  active={(target.textSize ?? 'sm') === size}
                  onClick={() => props.onSetTextSize(size)}
                >
                  {glyph}
                </SizeButton>
              ))}
            </div>
            <ContextMenuDivider />
            <ColourRow
              label="Colour"
              value={target.textColor ?? '#0f172a'}
              onChange={props.onSetTextColor}
              {...colorProps('text')}
              presets={props.presetColors}
            />
          </MenuAccordionSection>
        ) : null}
        {/* Layer — a collapsible section grouping front/back + opacity +
            (for boxed elements) the aspect-ratio lock. */}
        <MenuAccordionSection title="Layer" icon={<LayersGlyph />} {...sectionProps('layer')}>
          {/* Layer order tweaks keep the menu open so you can nudge
              front/back a few times in a row. */}
          <MenuTileGrid cols={2}>
            <MenuTile
              icon={<LayerUpIcon />}
              label="Bring to Front"
              onClick={props.onBringToFront}
            />
            <MenuTile icon={<LayerDownIcon />} label="Send to Back" onClick={props.onSendToBack} />
          </MenuTileGrid>
          <ContextMenuDivider />
          {/* Opacity slider — a non-closing row (dragging stays inside the
              menu, so the outside-click guard leaves it open). */}
          <OpacityRow
            value={(target as { opacity?: number }).opacity ?? 1}
            onChange={props.onSetOpacity}
          />
          {boxed ? (
            <>
              <ContextMenuDivider />
              {/* Lock aspect ratio — the whole row toggles (the switch is a
                  presentational <span> so we don't nest a button in a button). */}
              <button
                type="button"
                onClick={props.onToggleAspectLock}
                aria-pressed={!!(target as { aspectLocked?: boolean }).aspectLocked}
                className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <span className="flex items-center gap-2">
                  <span className="text-slate-400 dark:text-slate-500">
                    <AspectLockMenuIcon />
                  </span>
                  Lock aspect ratio
                </span>
                <ToggleSwitch
                  presentational
                  checked={!!(target as { aspectLocked?: boolean }).aspectLocked}
                  label="Lock aspect ratio"
                />
              </button>
            </>
          ) : null}
        </MenuAccordionSection>
        {/* Colours — text / background / border swatches. Boxed elements that
            support colours (excludes images). Icons included: Text tints a
            line-art glyph, Background / Border paint the icon's box. */}
        {boxed && supportsColours(target) ? (
          <>
            <MenuAccordionSection
              title="Colours"
              icon={<PaletteMenuIcon />}
              {...sectionProps('colours')}
            >
              <ColourRow
                label="Text"
                value={
                  (target as { textColor?: string }).textColor ??
                  defaultTextColor(target as BoxedElement)
                }
                onChange={props.onSetTextColor}
                {...colorProps('text')}
                presets={props.presetColors}
              />
              {defaultFillColor(target as BoxedElement) !== 'transparent' ? (
                <ColourRow
                  label="Background"
                  value={
                    (target as { fillColor?: string }).fillColor ??
                    defaultFillColor(target as BoxedElement)
                  }
                  onChange={props.onSetFillColor}
                  {...colorProps('background')}
                  presets={props.presetColors}
                />
              ) : null}
              {defaultStrokeColor(target as BoxedElement) !== 'transparent' ? (
                <ColourRow
                  label="Border"
                  value={
                    (target as { strokeColor?: string }).strokeColor ??
                    defaultStrokeColor(target as BoxedElement)
                  }
                  onChange={props.onSetStrokeColor}
                  {...colorProps('border')}
                  presets={props.presetColors}
                />
              ) : null}
              <div className="px-2 pb-1 pt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    props.onResetColors();
                    onClose();
                  }}
                  className="inline-flex w-full cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15"
                >
                  Reset to theme
                </button>
              </div>
            </MenuAccordionSection>
          </>
        ) : null}
        {/* Border — strength / pattern / radius. */}
        {borderable ? (
          <>
            <MenuAccordionSection title="Border" icon={<BorderGlyph />} {...sectionProps('border')}>
              <div className="px-2 py-1">
                <BorderGrid label="Strength" cols={5}>
                  {BORDER_STROKES.map((v) => (
                    <BorderButton
                      key={v}
                      active={borderStrokeVal === v}
                      onClick={() => props.onSetBorderStroke(v)}
                    >
                      <BorderStrokeIcon value={v} />
                    </BorderButton>
                  ))}
                </BorderGrid>
                <BorderGrid label="Pattern" cols={3}>
                  {BORDER_STYLES.map((v) => (
                    <BorderButton
                      key={v}
                      active={borderStyleVal === v}
                      onClick={() => props.onSetBorderStyle(v)}
                    >
                      <BorderStyleIcon value={v} />
                    </BorderButton>
                  ))}
                </BorderGrid>
                {supportsBorderRadius(target) ? (
                  <BorderGrid label="Radius" cols={4}>
                    {BORDER_RADII.map((v) => (
                      <BorderButton
                        key={v}
                        active={borderRadiusVal === v}
                        onClick={() => props.onSetBorderRadius(v)}
                      >
                        <BorderRadiusIcon value={v} />
                      </BorderButton>
                    ))}
                  </BorderGrid>
                ) : null}
              </div>
            </MenuAccordionSection>
          </>
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
        {/* Collaborate — link / note / comments. Boxed-only: arrows can't be
            linked, noted, or commented on. */}
        {boxed ? (
          <MenuAccordionSection
            title="Collaborate"
            icon={<CommentMenuIcon />}
            {...sectionProps('collaborate')}
          >
            {/* Link-cards have their own Link category (set / change / remove),
                so the generic "Link to Source" is dropped here for them. */}
            <MenuTileGrid cols={target.type === 'link-card' ? 2 : 3}>
              {target.type !== 'link-card' ? (
                <MenuTile
                  icon={<LinkMenuIcon />}
                  label={target.link ? 'Edit Link' : 'Link to Source'}
                  onClick={() => {
                    props.onLinkElement(target.id);
                    onClose();
                  }}
                />
              ) : null}
              <MenuTile
                icon={<NoteMenuIcon />}
                label={target.note ? 'Edit Note' : 'Add Note'}
                onClick={() => {
                  props.onOpenNote(target.id);
                  onClose();
                }}
              />
              <MenuTile
                icon={<CommentMenuIcon />}
                label="View Comments"
                onClick={() => {
                  props.onOpenComments(target.id);
                  onClose();
                }}
              />
            </MenuTileGrid>
          </MenuAccordionSection>
        ) : null}
      </ContextMenu>
    );
  }

  // Canvas-menu Session styles (shared by the timer + vote rows).
  const sessChip = (on: boolean) =>
    on
      ? 'flex-1 rounded-md border border-brand-400 bg-brand-50 px-2 py-1 text-[11px] font-medium text-brand-800 dark:bg-brand-500/20 dark:text-brand-100'
      : 'flex-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 transition hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300';
  const sessBtn =
    'inline-flex w-full items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15';
  const sessBtnPrimary =
    'inline-flex w-full items-center justify-center gap-1 rounded-md bg-brand-500 px-2 py-1.5 text-[11px] font-semibold text-white transition hover:bg-brand-600';
  const timer = props.timer;
  const vote = props.vote;
  const totalVotesCast = vote ? Object.values(vote.votes).reduce((n, ids) => n + ids.length, 0) : 0;

  return (
    <ContextMenu position={position} onClose={onClose} flush anchorBottom={menu.openUp}>
      {/* Canvas — theme / background / tidy. */}
      <MenuAccordionSection title="Canvas" icon={<CanvasMenuIcon />} {...sectionProps('canvas')}>
        <MenuTileGrid cols={3}>
          <MenuTile
            icon={<PaletteMenuIcon />}
            label="Change Theme"
            onClick={() => {
              props.onChangeTheme();
              onClose();
            }}
          />
          <MenuTile
            icon={<CanvasMenuIcon />}
            label="Change Canvas"
            onClick={() => {
              props.onChangeCanvas();
              onClose();
            }}
          />
          <MenuTile
            icon={<AutoAlignIcon />}
            label="Auto-align"
            onClick={() => {
              props.onAutoAlign();
              onClose();
            }}
          />
        </MenuTileGrid>
      </MenuAccordionSection>
      {/* Add — drop a new element on the canvas. */}
      <MenuAccordionSection title="Add" icon={<SquareMenuIcon />} {...sectionProps('add')}>
        <MenuTileGrid cols={2}>
          <MenuTile
            icon={<SquareMenuIcon />}
            label="Square"
            onClick={() => {
              props.onAddShape('square');
              onClose();
            }}
          />
          <MenuTile
            icon={<StickyMenuIcon />}
            label="Sticky"
            onClick={() => {
              props.onAddSticky();
              onClose();
            }}
          />
          <MenuTile
            icon={<PencilMenuIcon />}
            label="Pencil"
            onClick={() => {
              props.onDrawPencil();
              onClose();
            }}
          />
          <MenuTile
            icon={<AnnotationMenuIcon />}
            label="Annotation"
            onClick={() => {
              props.onAddAnnotation();
              onClose();
            }}
          />
        </MenuTileGrid>
      </MenuAccordionSection>
      {/* Session — timer + voting facilitator tools (spec/39). The full
          surface (mode, duration, pause/resume/reset, dots-per-person,
          reveal) lives here; actions keep the menu open so a facilitator can
          configure then start without re-opening. */}
      <MenuAccordionSection title="Session" icon={<SessionGlyph />} {...sectionProps('session')}>
        <div className="px-2.5 pb-2 pt-1">
          {/* Timer */}
          <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Timer
          </p>
          {!timer ? (
            <div className="mt-1 flex flex-col gap-1.5">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setTimerMode('countdown')}
                  className={sessChip(timerMode === 'countdown')}
                >
                  Countdown
                </button>
                <button
                  type="button"
                  onClick={() => setTimerMode('stopwatch')}
                  className={sessChip(timerMode === 'stopwatch')}
                >
                  Stopwatch
                </button>
              </div>
              {timerMode === 'countdown' ? (
                <div className="grid grid-cols-4 gap-1">
                  {[1, 3, 5, 10].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setDurationMin(m)}
                      className={sessChip(durationMin === m)}
                    >
                      {m}m
                    </button>
                  ))}
                </div>
              ) : null}
              <button
                type="button"
                onClick={() =>
                  props.onStartTimer(
                    timerMode,
                    timerMode === 'countdown' ? durationMin * 60_000 : undefined,
                  )
                }
                className={sessBtnPrimary}
              >
                Start {timerMode === 'countdown' ? `${durationMin}m countdown` : 'stopwatch'}
              </button>
            </div>
          ) : (
            <div className="mt-1 flex flex-col gap-1.5">
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                {timer.mode === 'countdown' ? 'Countdown' : 'Stopwatch'} ·{' '}
                <span className="font-semibold tabular-nums">
                  {fmtClock(timerDisplayMs(timer, Date.now()))}
                </span>{' '}
                {timer.running ? 'running' : 'paused'}
              </p>
              <div className="grid grid-cols-3 gap-1">
                {timer.running ? (
                  <button type="button" onClick={props.onPauseTimer} className={sessBtn}>
                    Pause
                  </button>
                ) : (
                  <button type="button" onClick={props.onResumeTimer} className={sessBtn}>
                    Resume
                  </button>
                )}
                <button type="button" onClick={props.onResetTimer} className={sessBtn}>
                  Reset
                </button>
                <button type="button" onClick={props.onClearTimer} className={sessBtn}>
                  Clear
                </button>
              </div>
            </div>
          )}
          {/* Vote */}
          <p className="mt-3 border-t border-slate-100 pt-3 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
            Vote
          </p>
          {!vote ? (
            <div className="mt-1 flex flex-col gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] text-slate-600 dark:text-slate-300">
                  Dots per person
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    aria-label="Fewer dots"
                    onClick={() => setVotesPerPerson((n) => Math.max(1, n - 1))}
                    className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
                  >
                    −
                  </button>
                  <span className="w-4 text-center text-[12px] font-semibold tabular-nums">
                    {votesPerPerson}
                  </span>
                  <button
                    type="button"
                    aria-label="More dots"
                    onClick={() => setVotesPerPerson((n) => Math.min(20, n + 1))}
                    className="flex h-6 w-6 items-center justify-center rounded-md border border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300"
                  >
                    +
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => props.onStartVote(votesPerPerson)}
                className={sessBtnPrimary}
              >
                Start vote
              </button>
            </div>
          ) : (
            <div className="mt-1 flex flex-col gap-1.5">
              <p className="text-[11px] text-slate-600 dark:text-slate-300">
                {vote.active ? 'Voting open' : vote.revealed ? 'Results shown' : 'Voting ended'} ·{' '}
                <span className="font-semibold tabular-nums">{totalVotesCast}</span> cast ·{' '}
                {vote.votesPerPerson} each
              </p>
              <div className="grid grid-cols-2 gap-1">
                {vote.active ? (
                  <button type="button" onClick={props.onEndVote} className={sessBtn}>
                    End vote
                  </button>
                ) : !vote.revealed ? (
                  <button type="button" onClick={props.onRevealVote} className={sessBtn}>
                    Show results
                  </button>
                ) : (
                  <span />
                )}
                <button type="button" onClick={props.onClearVote} className={sessBtn}>
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>
      </MenuAccordionSection>
    </ContextMenu>
  );
}

// Clock face — the Session category glyph.
function SessionGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <circle cx="8" cy="8.5" r="5.5" />
      <path d="M8 5.5V8.5L10 10M8 2.5V1" />
    </svg>
  );
}

// m:ss for the active-timer readout (a static snapshot — the live ticking
// countdown lives in the floating TimerWidget).
function fmtClock(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// 6-hex or fall back to white for the native colour input (it can't take
// 'transparent' or named colours).
function hexish(color: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(color) ? color : '#ffffff';
}

// A small preset palette for the inline colour picker. The "+" custom chip
// still opens the OS picker for anything off-palette.
// One labelled colour row inside the Colours section: the label + current
// swatch toggle an inline preset palette (clicking the row again closes it,
// so the picker never gets stuck open). A "+" chip opens the OS picker for a
// custom colour.
function ColourRow({
  label,
  value,
  open,
  onToggle,
  onChange,
  presets,
}: {
  label: string;
  value: string;
  open: boolean;
  onToggle: () => void;
  onChange: (color: string) => void;
  // Preset swatches to offer — derived from the active theme so they match it.
  presets: string[];
}) {
  return (
    <div>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center justify-between px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <span>{label}</span>
        <span
          className="h-4 w-4 rounded border border-slate-300 dark:border-slate-600"
          style={{ backgroundColor: hexish(value) }}
          aria-hidden
        />
      </button>
      {open ? (
        // Swatches are sized for a comfortable touch target on mobile.
        <div className="flex flex-wrap items-center gap-1.5 px-3 pb-2.5 pt-1">
          {presets.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={c}
              onClick={() => onChange(c)}
              className={`h-7 w-7 cursor-pointer rounded-md border transition ${
                value.toLowerCase() === c.toLowerCase()
                  ? 'border-brand-500 ring-1 ring-brand-400'
                  : 'border-slate-300 hover:scale-110 dark:border-slate-600'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
          <label
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-dashed border-slate-300 text-sm leading-none text-slate-500 dark:border-slate-600"
            aria-label={`Custom ${label} colour`}
          >
            +
            <input
              type="color"
              value={hexish(value)}
              onChange={(e) => onChange(e.target.value)}
              className="absolute h-0 w-0 opacity-0"
            />
          </label>
        </div>
      ) : null}
    </div>
  );
}

const BORDER_STROKES: readonly BorderStroke[] = ['none', 'thin', 'medium', 'thick', 'extra-thick'];
const BORDER_STYLES: readonly BorderStyle[] = [
  'solid',
  'dashed',
  'dotted',
  'dash-dot',
  'long-dash',
  'dash-dot-dot',
];
const BORDER_RADII: readonly BorderRadius[] = ['none', 'sm', 'md', 'lg'];

type IconPos = 'left' | 'right' | 'above' | 'below';

// A small arrow pointing in `dir` (one up-arrow path, rotated).
function DirArrow({ dir }: { dir: 'up' | 'down' | 'left' | 'right' }) {
  const rot = { up: 0, right: 90, down: 180, left: 270 }[dir];
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ transform: `rotate(${rot}deg)` }}
    >
      <path d="M6 2.5V9.5M3 5.5 6 2.5 9 5.5" />
    </svg>
  );
}

// The inline-icon placement picker laid out as a cross (Top / Left / Right /
// Bottom around an empty centre), each cell an arrow + label.
function IconPositionGrid({
  current,
  onPick,
}: {
  current: string;
  onPick: (pos: IconPos) => void;
}) {
  const cell = (key: IconPos, label: string, dir: 'up' | 'down' | 'left' | 'right') => (
    <button
      type="button"
      aria-pressed={current === key}
      onClick={() => onPick(key)}
      className={`flex items-center justify-center gap-1 rounded px-1.5 py-1 text-[11px] font-medium transition ${
        current === key
          ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
      }`}
    >
      <DirArrow dir={dir} />
      {label}
    </button>
  );
  return (
    <div className="grid grid-cols-3 gap-1 px-2 pb-1.5">
      <span />
      {cell('above', 'Top', 'up')}
      <span />
      {cell('left', 'Left', 'left')}
      <span />
      {cell('right', 'Right', 'right')}
      <span />
      {cell('below', 'Bottom', 'down')}
      <span />
    </div>
  );
}

// One labelled button grid in the Border section. Literal column classes so
// Tailwind keeps them.
function BorderGrid({
  label,
  cols,
  children,
}: {
  label: string;
  cols: 3 | 4 | 5;
  children: ReactNode;
}) {
  const colClass = cols === 5 ? 'grid-cols-5' : cols === 4 ? 'grid-cols-4' : 'grid-cols-3';
  return (
    <div className="mb-1.5 last:mb-0">
      <p className="px-1 pb-1 text-[10px] font-medium text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <div className={`grid gap-1 ${colClass}`}>{children}</div>
    </div>
  );
}

// Border preset button — SizeButton with the menu's active tone.
function BorderButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <SizeButton active={active} onClick={onClick}>
      {children}
    </SizeButton>
  );
}

// Orientation preview for the Rotation category: a small square with a
// marker on its top edge, rotated by `deg` about its centre. The tilt shows
// at a glance which way the element will end up facing.
function RotationGlyph({ deg }: { deg: number }) {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <g transform={`rotate(${deg} 8 8)`}>
        <rect x="3.5" y="3.5" width="9" height="9" rx="1.5" />
        {/* Filled tab centred on the top edge marks "up". */}
        <circle cx="8" cy="3.5" r="1.3" fill="currentColor" stroke="none" />
      </g>
    </svg>
  );
}

// Diagonal stroke — the "Line" section glyph.
function LineGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <path d="M3 13L13 3" />
    </svg>
  );
}

// Arrow → glyph — the "Pointer" section.
function PointerGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2.5 8h10M9 4.5 12.5 8 9 11.5" />
    </svg>
  );
}

// Grid glyph — the "Table" section.
function TableGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
      <path d="M2.5 6.5h11M6.5 6.5V13M2.5 9.8h11" />
    </svg>
  );
}

// Picture glyph — the "Image" section.
function ImageGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="3" width="11" height="10" rx="1.5" />
      <circle cx="6" cy="6.5" r="1" />
      <path d="M3 12l3-3 2.5 2.5L11 8l2 2" />
    </svg>
  );
}

// Rounded-square outline — the "Border" section glyph.
function BorderGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden
    >
      <rect x="2.5" y="2.5" width="11" height="11" rx="2.5" />
    </svg>
  );
}

// A full-width row whose whole surface toggles an iOS-style switch (the
// switch is presentational so we don't nest a button in a button). Shared by
// the Layer aspect-lock row + the Table header/zebra toggles.
function MenuToggleRow({
  label,
  description,
  checked,
  onToggle,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={checked}
      className="flex w-full cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
    >
      <span className="flex flex-col">
        <span className="text-xs font-medium text-slate-700 dark:text-slate-200">{label}</span>
        {description ? (
          <span className="text-[10px] text-slate-500 dark:text-slate-400">{description}</span>
        ) : null}
      </span>
      <ToggleSwitch presentational checked={checked} label={label} />
    </button>
  );
}

// Grid wrapper for MenuTiles. Literal column classes so Tailwind keeps them.

// Opacity slider row inside the context menu. Doesn't close the menu on
// interaction (it isn't a MenuItem): dragging fires pointer events inside
// the menu, so the ContextMenu's outside-click guard keeps it open.
function OpacityRow({ value, onChange }: { value: number; onChange: (opacity: number) => void }) {
  const pct = Math.round(value * 100);
  return (
    <div className="px-3 py-1.5">
      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Opacity</p>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={100}
          value={pct}
          onChange={(e) => onChange(Number(e.target.value) / 100)}
          aria-label="Opacity"
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-500 dark:bg-slate-700"
        />
        <span className="w-10 text-right text-xs font-medium text-slate-700 dark:text-slate-200">
          {pct}%
        </span>
      </div>
    </div>
  );
}

// Stacked diamonds — the "Layer" section glyph. 12x12 stroke style of the
// shared context-menu icons.
function LayersGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 2 14 5.5 8 9 2 5.5z" />
      <path d="m3.5 8 4.5 2.6L12.5 8M3.5 11l4.5 2.6L12.5 11" />
    </svg>
  );
}

// Rectangle with corner ticks — "lock aspect ratio". 12x12 stroke style of
// the shared context-menu icons.
function AspectLockMenuIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="2.5" width="11" height="11" rx="1.5" />
      <path d="M5 8.5v2.5h2.5M11 7.5V5H8.5" />
    </svg>
  );
}

// A serif "A" — the "Text" category glyph.
function TextGlyph() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      <text
        x="8"
        y="12"
        textAnchor="middle"
        fontSize="13"
        fontWeight="600"
        fontFamily="Georgia, serif"
      >
        A
      </text>
    </svg>
  );
}

// A square toggle for the arrow Text category (B / I / U / S).
function TextToggle({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-md transition ${
        active
          ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-100'
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white'
      }`}
    >
      {children}
    </button>
  );
}

// Glyphs for the multi-selection menu (12px, context-menu stroke style).
function DuplicateMenuIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="2.5" width="8" height="8" rx="1.5" />
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" fill="white" />
    </svg>
  );
}
function GroupMenuIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="2" width="6" height="6" rx="1" />
      <rect x="8" y="8" width="6" height="6" rx="1" />
    </svg>
  );
}
function UngroupMenuIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      strokeDasharray="2.5 2"
      aria-hidden
    >
      <rect x="2" y="2" width="6" height="6" rx="1" />
      <rect x="8" y="8" width="6" height="6" rx="1" />
    </svg>
  );
}
function LockMenuIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3.5" y="7" width="9" height="6.5" rx="1.5" />
      <path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" />
    </svg>
  );
}

// A star — the "Icon" category glyph (the un-slashed sibling of
// RemoveIconGlyph).
function IconCategoryGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 2.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6L8 11.2 4.8 12.9l.6-3.6L2.8 6.8l3.6-.5z" />
    </svg>
  );
}

// A star glyph with a slash — "remove the inline icon". Matches the
// 12x12 stroke style of the shared context-menu icons.
function RemoveIconGlyph() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 2.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6L8 11.2 4.8 12.9l.6-3.6L2.8 6.8l3.6-.5z" />
      <path d="M2.5 13.5l11-11" />
    </svg>
  );
}
