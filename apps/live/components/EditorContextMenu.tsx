'use client';

// Right-click context menu for the editor, lifted out of
// editor-page.tsx. Renders one of two menus depending on what was
// clicked: a single-element menu (link / layer order / note /
// comment) or a whole-selection 'multi' menu. The canvas (empty-space)
// right-click opens the tab menu with its canvas sections folded in,
// rendered by the TabBar — not here. Duplicate lives in the selection
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
  ANIMATION_SPEEDS,
  ARROW_FLOWS,
  arrowStyleOf,
  arrowThicknessOf,
  defaultFillColor,
  defaultStrokeColor,
  defaultTextColor,
  ELEMENT_ANIMATIONS,
  ICON_ANIMATIONS,
  isBoxed,
  isProgressShape,
  PROGRESS_ANIMS,
  supportsBorderControls,
  supportsBorderRadius,
  supportsColours,
  type AnimationSpeed,
  type ArrowEnds,
  type ArrowFlow,
  type ArrowheadShape,
  type ArrowheadSize,
  type ArrowStyle,
  type ArrowThickness,
  type BorderRadius,
  type BorderStroke,
  type BorderStyle,
  type BoxedElement,
  type Element,
  type ElementAnimation,
  type IconAnimation,
  type ProgressAnim,
  type ShapeElement,
  type ShapeKind,
  type TextSize,
} from '@livediagram/diagram';
import { ArrowLineControls, ArrowPointerControls } from '@/components/arrow-controls';
import { ContextMenu, ContextMenuDivider } from '@/components/ContextMenu';
import { hexish, SizeButton, ToggleSwitch } from '@/components/palette-controls';
import {
  BoldIcon,
  BorderRadiusIcon,
  BorderStrokeIcon,
  BorderStyleIcon,
  DotsIcon,
  ItalicIcon,
  ScaleIcon,
  StrikethroughIcon,
  UnderlineIcon,
} from '@/components/palette-icons';
import {
  BorderGlyph,
  CommentMenuIcon,
  DirArrow,
  ImageGlyph,
  LayerDownIcon,
  LayersGlyph,
  LayerUpIcon,
  LineGlyph,
  LinkMenuIcon,
  AnimationKindGlyph,
  AnimationMenuGlyph,
  FlowKindGlyph,
  IconAnimKindGlyph,
  ProgressAnimKindGlyph,
  ProgressMenuGlyph,
  NoteMenuIcon,
  PaletteMenuIcon,
  PointerGlyph,
  RotationGlyph,
  SquareMenuIcon,
  TableGlyph,
} from '@/components/context-menu-icons';
import {
  MenuAccordionSection,
  MenuGroupSeparator,
  MenuTile,
  MenuTileGrid,
} from '@/components/PortalMenu';
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
  // Animated elements (spec/09): a looping animation on boxed elements, and a
  // flow animation on arrows. `null` clears it.
  onSetAnimation: (value: ElementAnimation | null) => void;
  onSetArrowFlow: (value: ArrowFlow | null) => void;
  onSetIconAnimation: (value: IconAnimation | null) => void;
  onSetIconAnimationSpeed: (value: AnimationSpeed) => void;
  onSetProgress: (value: number) => void;
  onSetProgressAnim: (value: ProgressAnim | null) => void;
  onSetAnimationSpeed: (value: AnimationSpeed) => void;
  onSetFlowSpeed: (value: AnimationSpeed) => void;
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
  // Reset the shape back to its kind's default aspect ratio (keeps area,
  // snaps the width:height proportion back to the canonical look).
  onResetAspectRatio: () => void;
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
  // The selected elements (multi-selection / group members), so the 'multi'
  // menu can surface the formatting categories that match their types (Colours
  // / Text / Border for boxed, Line + Pointer for arrows). The format setters
  // above apply to the whole selection. Duplicate / Group / Lock / Export /
  // Delete are NOT here — the selection toolbar carries those.
  selectionElements: Element[];
};

export function EditorContextMenu(props: EditorContextMenuProps) {
  const { menu, elements, onClose } = props;
  const position = { x: menu.x, y: menu.y };
  // Grow UPWARD when the menu is opened in the bottom fifth of the
  // viewport, so the tall collapsible-category menu opens above the
  // cursor instead of running off-screen — matching the tab menu.
  const anchorBottom = typeof window !== 'undefined' && menu.y > window.innerHeight * 0.8;
  // Which collapsible section is open in the element menu — at most one at a
  // time (null = all collapsed). An accordion the user can only open one of.
  const [openSection, setOpenSection] = useState<string | null>(null);
  const sectionProps = (id: string) => ({
    open: openSection === id,
    onToggle: () => setOpenSection((s) => (s === id ? null : id)),
    // Rows sit flush (no per-row hairline); the only rules in this menu are the
    // MenuGroupSeparator bands, so grouping reads at a glance.
    flush: true,
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

  if (menu.mode === 'multi') {
    // The selection toolbar (SelectionPopover / MultiSelectionToolbar) already
    // carries Duplicate / Group / Lock / Export / Delete, so this menu is
    // purely the type-aware formatting categories its ellipsis opens. A
    // selection with nothing formattable (e.g. only images) shows no menu
    // rather than an empty box.
    const selectionFormattable =
      props.selectionElements.some((el) => supportsColours(el)) ||
      props.selectionElements.some((el) => supportsBorderControls(el)) ||
      props.selectionElements.some((el) => el.type === 'arrow');
    if (!selectionFormattable) return null;
    return (
      <ContextMenu position={position} onClose={onClose} flush anchorBottom={anchorBottom}>
        {(() => {
          // Type-aware formatting for the whole selection: only the categories
          // that match the selected element types show, and each control
          // applies to every matching member (the setters are selection-wide).
          // Display values read off the first matching member.
          const sel = props.selectionElements;
          const boxedSel = sel.filter(isBoxed);
          const arrowSel = sel.filter((el) => el.type === 'arrow');
          const colourable = sel.some((el) => supportsColours(el));
          const borderableSel = sel.some((el) => supportsBorderControls(el));
          const textSrc = boxedSel[0] ?? arrowSel[0];
          const fillSrc = boxedSel.find(
            (el) => defaultFillColor(el as BoxedElement) !== 'transparent',
          ) as BoxedElement | undefined;
          const strokeSrc = boxedSel.find(
            (el) => defaultStrokeColor(el as BoxedElement) !== 'transparent',
          ) as BoxedElement | undefined;
          const borderSrc = sel.find((el) => supportsBorderControls(el)) as
            | { strokeWidth?: BorderStroke; strokeStyle?: BorderStyle; type: string }
            | undefined;
          const arrowSrc = arrowSel[0];
          if (!colourable && !borderableSel && !arrowSel.length) return null;
          // Same grouping as the single-element menu: appearance (Animation /
          // Colours / Border) · content (Line / Pointer / Text). Layer / Shape /
          // Rotation / Icon / Image / Table / Link / Collaborate don't apply to a
          // multi-selection, so those groups stay excluded.
          const showMultiAppearance =
            boxedSel.length > 0 || !!arrowSrc || colourable || borderableSel;
          const showMultiContent = !!arrowSrc || !!textSrc;
          return (
            <>
              {/* Animation (spec/09) — applies to every boxed member of the
                  selection. */}
              {boxedSel.length ? (
                <MenuAccordionSection
                  title="Animation"
                  icon={<AnimationMenuGlyph />}
                  {...sectionProps('m-animation')}
                >
                  <AnimationTiles
                    animation={boxedSel[0]!.animation ?? null}
                    speed={boxedSel[0]!.animationSpeed ?? 'normal'}
                    onSet={props.onSetAnimation}
                    onSetSpeed={props.onSetAnimationSpeed}
                  />
                </MenuAccordionSection>
              ) : null}
              {arrowSrc ? (
                <MenuAccordionSection
                  title="Animation"
                  icon={<AnimationMenuGlyph />}
                  {...sectionProps('m-flow')}
                >
                  <FlowTiles
                    flow={arrowSrc.flow ?? null}
                    speed={arrowSrc.flowSpeed ?? 'normal'}
                    onSet={props.onSetArrowFlow}
                    onSetSpeed={props.onSetFlowSpeed}
                  />
                </MenuAccordionSection>
              ) : null}
              {colourable ? (
                <MenuAccordionSection
                  title="Colours"
                  icon={<PaletteMenuIcon />}
                  {...sectionProps('m-colours')}
                >
                  {textSrc ? (
                    <ColourRow
                      label="Text"
                      value={
                        (textSrc as { textColor?: string }).textColor ??
                        defaultTextColor(textSrc as BoxedElement)
                      }
                      onChange={props.onSetTextColor}
                      {...colorProps('m-text')}
                      presets={props.presetColors}
                    />
                  ) : null}
                  {fillSrc ? (
                    <ColourRow
                      label="Background"
                      value={fillSrc.fillColor ?? defaultFillColor(fillSrc)}
                      onChange={props.onSetFillColor}
                      {...colorProps('m-bg')}
                      presets={props.presetColors}
                    />
                  ) : null}
                  {strokeSrc ? (
                    <ColourRow
                      label="Border"
                      value={strokeSrc.strokeColor ?? defaultStrokeColor(strokeSrc)}
                      onChange={props.onSetStrokeColor}
                      {...colorProps('m-border')}
                      presets={props.presetColors}
                    />
                  ) : null}
                </MenuAccordionSection>
              ) : null}
              {borderableSel ? (
                <MenuAccordionSection
                  title="Border"
                  icon={<BorderGlyph />}
                  {...sectionProps('m-border-style')}
                >
                  <div className="px-2 py-1">
                    <BorderGrid label="Strength" cols={5}>
                      {BORDER_STROKES.map((v) => (
                        <BorderButton
                          key={v}
                          active={(borderSrc?.strokeWidth ?? 'medium') === v}
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
                          active={(borderSrc?.strokeStyle ?? 'solid') === v}
                          onClick={() => props.onSetBorderStyle(v)}
                        >
                          <BorderStyleIcon value={v} />
                        </BorderButton>
                      ))}
                    </BorderGrid>
                  </div>
                </MenuAccordionSection>
              ) : null}
              {/* ── Content group: Line / Pointer / Text ── */}
              {showMultiContent && showMultiAppearance ? <MenuGroupSeparator /> : null}
              {arrowSrc ? (
                <>
                  <MenuAccordionSection
                    title="Line"
                    icon={<LineGlyph />}
                    {...sectionProps('m-line')}
                  >
                    <div className="px-3 py-1.5">
                      <ArrowLineControls
                        thickness={arrowThicknessOf(arrowSrc)}
                        style={arrowStyleOf(arrowSrc)}
                        strokeStyle={arrowSrc.strokeStyle ?? 'solid'}
                        onSetThickness={props.onSetArrowThickness}
                        onSetStyle={props.onSetArrowStyle}
                        onSetStrokeStyle={props.onSetArrowStrokeStyle}
                      />
                    </div>
                  </MenuAccordionSection>
                  <MenuAccordionSection
                    title="Pointer"
                    icon={<PointerGlyph />}
                    {...sectionProps('m-pointer')}
                  >
                    <div className="px-3 py-1.5">
                      <ArrowPointerControls
                        ends={arrowSrc.arrowEnds ?? 'to'}
                        headSize={arrowheadSizeOf(arrowSrc)}
                        headShape={arrowheadShapeOf(arrowSrc)}
                        onSetEnds={props.onSetArrowEnds}
                        onSetHeadSize={props.onSetArrowheadSize}
                        onSetHeadShape={props.onSetArrowheadShape}
                      />
                    </div>
                  </MenuAccordionSection>
                </>
              ) : null}
              {textSrc ? (
                <MenuAccordionSection
                  title="Text"
                  icon={<TextGlyph />}
                  {...sectionProps('m-text-size')}
                >
                  <p className="px-3 pb-1 pt-1.5 text-[10px] font-medium text-slate-500 dark:text-slate-400">
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
                        active={(textSrc as { textSize?: TextSize }).textSize === size}
                        onClick={() => props.onSetTextSize(size)}
                      >
                        {glyph}
                      </SizeButton>
                    ))}
                  </div>
                </MenuAccordionSection>
              ) : null}
            </>
          );
        })()}
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
    // Regular shapes (not the dedicated icon glyph, not a frame container, not
    // a progress element which carries its own `progress` data) can morph to
    // another common kind in place.
    const isProgress = target.type === 'shape' && isProgressShape(target.shape);
    const morphable = target.type === 'shape' && !isIcon && target.shape !== 'frame' && !isProgress;
    // Consistent category grouping (spec/09): placement (Layer / Shape /
    // Rotation) · appearance (Progress / Animation / Colours / Border) ·
    // content (Line / Pointer / Text / Icon / Image / Table / Link) ·
    // collaboration. A group divider renders above a group only when that
    // group has a visible section, so an absent group never leaves a dangling
    // rule. Placement always shows (Layer is unconditional), so each later
    // group's divider just gates on the group's own visibility.
    const showAppearanceGroup = boxed || target.type === 'arrow';
    const showContentGroup =
      target.type === 'arrow' ||
      target.type === 'table' ||
      target.type === 'image' ||
      target.type === 'link-card' ||
      hasInlineIcon;
    const showCollaborateGroup = boxed;
    return (
      <ContextMenu position={position} onClose={onClose} flush anchorBottom={anchorBottom}>
        {/* Layer — pinned FIRST in the menu (before the type-specific
            categories, which render conditionally and so would otherwise
            shuffle Layer's position around). Groups front/back + opacity +
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
                  <span className="text-slate-400 dark:text-slate-400">
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
            <div className="px-2 pb-1.5 pt-0.5">
              <button
                type="button"
                onClick={() => {
                  props.onResetAspectRatio();
                  onClose();
                }}
                className="inline-flex w-full cursor-pointer items-center justify-center rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15"
              >
                Reset aspect ratio
              </button>
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
        {/* ── Appearance group: Progress / Animation / Colours / Border ── */}
        {showAppearanceGroup ? <MenuGroupSeparator /> : null}
        {/* Progress (spec/46) — the percentage + how the fill animates. Only
            for progress bars / rings. */}
        {isProgress ? (
          <MenuAccordionSection
            title="Progress"
            icon={<ProgressMenuGlyph />}
            {...sectionProps('progress')}
          >
            <ProgressRow
              value={(target as ShapeElement).progress ?? 50}
              onChange={props.onSetProgress}
            />
            <ProgressAnimTiles
              anim={(target as ShapeElement).progressAnim ?? null}
              onSet={props.onSetProgressAnim}
            />
          </MenuAccordionSection>
        ) : null}
        {/* Animation (spec/09) — a looping attention/status effect on the
            element. None clears it. */}
        {boxed ? (
          <MenuAccordionSection
            title="Animation"
            icon={<AnimationMenuGlyph />}
            {...sectionProps('animation')}
          >
            {isIcon ? (
              // Icons get their own glyph-motion set (spin / beat / pulse / …)
              // instead of the boxed-element animation set.
              <IconAnimationTiles
                animation={(target as { iconAnimation?: IconAnimation }).iconAnimation ?? null}
                speed={
                  (target as { iconAnimationSpeed?: AnimationSpeed }).iconAnimationSpeed ?? 'normal'
                }
                onSet={props.onSetIconAnimation}
                onSetSpeed={props.onSetIconAnimationSpeed}
              />
            ) : (
              <AnimationTiles
                animation={(target as { animation?: ElementAnimation }).animation ?? null}
                speed={(target as { animationSpeed?: AnimationSpeed }).animationSpeed ?? 'normal'}
                onSet={props.onSetAnimation}
                onSetSpeed={props.onSetAnimationSpeed}
              />
            )}
          </MenuAccordionSection>
        ) : null}
        {/* Animation (spec/09) — animate an arrow to show direction: marching
            dashes, a travelling dot, beads, or an in-place pulse / grow / glow.
            None clears it. (Labelled "Animation" to match the boxed-element
            control; the field is still `flow`.) */}
        {target.type === 'arrow' ? (
          <MenuAccordionSection
            title="Animation"
            icon={<AnimationMenuGlyph />}
            {...sectionProps('flow')}
          >
            <FlowTiles
              flow={(target as { flow?: ArrowFlow }).flow ?? null}
              speed={(target as { flowSpeed?: AnimationSpeed }).flowSpeed ?? 'normal'}
              onSet={props.onSetArrowFlow}
              onSetSpeed={props.onSetFlowSpeed}
            />
          </MenuAccordionSection>
        ) : null}
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
                  <BorderGrid label="Radius" cols={5}>
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
        {/* ── Content group: Line / Pointer / Text / Icon / Image / Table / Link ── */}
        {showContentGroup ? <MenuGroupSeparator /> : null}
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
        {/* ── Collaboration group ── */}
        {showCollaborateGroup ? <MenuGroupSeparator /> : null}
        {/* Collaborate — link / note / comments. Boxed-only: arrows can't be
            linked, noted, or commented on. */}
        {boxed ? (
          <MenuAccordionSection
            title="Collaborate"
            icon={<CommentMenuIcon />}
            {...sectionProps('collaborate')}
          >
            {/* Link-cards have their own Link category (set / change / remove),
                so the generic "Add Link" is dropped here for them. */}
            <MenuTileGrid cols={target.type === 'link-card' ? 2 : 3}>
              {target.type !== 'link-card' ? (
                <MenuTile
                  icon={<LinkMenuIcon />}
                  label={target.link ? 'Edit Link' : 'Add Link'}
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
                label="Comments"
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

  // The canvas right-click menu moved to the tab menu (TabBar) so it reuses
  // every tab handler with the canvas sections folded in; this component now
  // only renders the element + multi menus. `menu.mode === 'canvas'` never
  // reaches here (the page routes it to the TabBar), so fall through to null.
  return null;
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
const BORDER_RADII: readonly BorderRadius[] = ['none', 'sm', 'md', 'lg', 'full'];

type IconPos = 'left' | 'right' | 'above' | 'below';

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

// Speed presets row (spec/09) — shown under an Animation / Flow control once
// an animation is picked. Slow / Normal / Fast scale the loop's duration.
function SpeedTiles({
  value,
  onSet,
}: {
  value: AnimationSpeed;
  onSet: (v: AnimationSpeed) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1 px-2 pb-1.5">
      {ANIMATION_SPEEDS.map((s) => (
        <SizeButton key={s} active={value === s} onClick={() => onSet(s)}>
          <span className="text-[10px] capitalize leading-none">{s}</span>
        </SizeButton>
      ))}
    </div>
  );
}

// Boxed-element Animation control: an illustrated tile per kind (None / Pulse /
// Blink / Glow / Trace / Gradient / Bounce / Wobble) plus the Speed row once one
// is active. Shared by the single and multi-select menus.
function AnimationTiles({
  animation,
  speed,
  onSet,
  onSetSpeed,
}: {
  animation: ElementAnimation | null;
  speed: AnimationSpeed;
  onSet: (v: ElementAnimation | null) => void;
  onSetSpeed: (v: AnimationSpeed) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
        {([null, ...ELEMENT_ANIMATIONS] as (ElementAnimation | null)[]).map((v) => (
          <SizeButton key={v ?? 'none'} active={animation === v} onClick={() => onSet(v)}>
            <span className="flex flex-col items-center gap-0.5">
              <AnimationKindGlyph kind={v} />
              <span className="text-[9px] capitalize leading-none">{v ?? 'None'}</span>
            </span>
          </SizeButton>
        ))}
      </div>
      {animation ? <SpeedTiles value={speed} onSet={onSetSpeed} /> : null}
    </>
  );
}

// Arrow Flow control: None / Dashes / Dots / Beads / Pulse / Grow / Glow
// illustrated, plus the Speed row.
function FlowTiles({
  flow,
  speed,
  onSet,
  onSetSpeed,
}: {
  flow: ArrowFlow | null;
  speed: AnimationSpeed;
  onSet: (v: ArrowFlow | null) => void;
  onSetSpeed: (v: AnimationSpeed) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
        {([null, ...ARROW_FLOWS] as (ArrowFlow | null)[]).map((v) => (
          <SizeButton key={v ?? 'none'} active={flow === v} onClick={() => onSet(v)}>
            <span className="flex flex-col items-center gap-0.5">
              <FlowKindGlyph kind={v} />
              <span className="text-[9px] capitalize leading-none">{v ?? 'None'}</span>
            </span>
          </SizeButton>
        ))}
      </div>
      {flow ? <SpeedTiles value={speed} onSet={onSetSpeed} /> : null}
    </>
  );
}

// Icon Animation control (spec/09): icons get their own glyph-motion set
// (Spin / Beat / Pulse / Bounce / Wiggle / Flash / Tada) instead of the
// boxed-element animation set. Like the boxed Animation + arrow Flow controls,
// a Speed row appears once a motion is picked.
function IconAnimationTiles({
  animation,
  speed,
  onSet,
  onSetSpeed,
}: {
  animation: IconAnimation | null;
  speed: AnimationSpeed;
  onSet: (v: IconAnimation | null) => void;
  onSetSpeed: (v: AnimationSpeed) => void;
}) {
  return (
    <>
      <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
        {([null, ...ICON_ANIMATIONS] as (IconAnimation | null)[]).map((v) => (
          <SizeButton key={v ?? 'none'} active={animation === v} onClick={() => onSet(v)}>
            <span className="flex flex-col items-center gap-0.5">
              <IconAnimKindGlyph kind={v} />
              <span className="text-[9px] capitalize leading-none">{v ?? 'None'}</span>
            </span>
          </SizeButton>
        ))}
      </div>
      {animation ? <SpeedTiles value={speed} onSet={onSetSpeed} /> : null}
    </>
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
// Progress percentage slider (spec/46). Mirrors OpacityRow but on a 0–100
// integer scale.
function ProgressRow({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="px-3 py-1.5">
      <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Percentage</p>
      <div className="mt-1 flex items-center gap-2">
        <input
          type="range"
          min={0}
          max={100}
          value={pct}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label="Percentage"
          className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-500 dark:bg-slate-700"
        />
        <span className="w-10 text-right text-xs font-medium text-slate-700 dark:text-slate-200">
          {pct}%
        </span>
      </div>
    </div>
  );
}

// Progress fill-animation tiles (spec/46): None / Fill / Pulse / Stripes.
function ProgressAnimTiles({
  anim,
  onSet,
}: {
  anim: ProgressAnim | null;
  onSet: (v: ProgressAnim | null) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
      {([null, ...PROGRESS_ANIMS] as (ProgressAnim | null)[]).map((v) => (
        <SizeButton key={v ?? 'none'} active={anim === v} onClick={() => onSet(v)}>
          <span className="flex flex-col items-center gap-0.5">
            <ProgressAnimKindGlyph kind={v} />
            <span className="text-[9px] capitalize leading-none">{v ?? 'None'}</span>
          </span>
        </SizeButton>
      ))}
    </div>
  );
}

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
