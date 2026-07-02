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

import { onMouseHover, useRevertOnUnmount } from '@/components/primitives/hover-preview';
import {
  arrowheadShapeOf,
  arrowheadSizeOf,
  arrowStyleOf,
  arrowThicknessOf,
  isBoxed,
  isChartShape,
  isProgressShape,
  isRailShape,
  isRatingShape,
} from '@livediagram/diagram';
import { ArrowLineControls, ArrowPointerControls } from '@/components/canvas/arrow-controls';
import { ContextMenu, ContextMenuDivider } from '@/components/palette/ContextMenu';
import { SizeButton, ToggleSwitch } from '@/components/palette/palette-controls';
import {} from '@/components/palette/palette-icons';
import {
  AspectLockMenuIcon,
  LayerDownIcon,
  LayersGlyph,
  LayerUpIcon,
  LineGlyph,
  PointerGlyph,
  RotationGlyph,
  SquareMenuIcon,
} from '@/components/palette/context-menu-icons';
import {
  MenuAccordionSection,
  MenuActionButton,
  MenuGroupSeparator,
  MenuTile,
  MenuTileGrid,
} from '@/components/primitives/PortalMenu';
import { ShapeIcon } from '@/components/primitives/shape-icon';

import {} from '@/components/palette/context-menu-tiles';
import { OpacityRow } from '@/components/palette/context-menu-rows';
import type { EditorContextMenuProps } from './EditorContextMenu.types';
import { useContextMenuScaffold } from './useContextMenuScaffold';
import { ElementContentSections } from './ElementContentSections';
import { ElementAppearanceSections } from './ElementAppearanceSections';
import { MultiSelectionContextMenu } from './MultiSelectionContextMenu';

import { COMMON_SHAPES, ROTATION_ANGLES } from './context-menu-constants';

// Cursor position + which menu to show. `element` carries the clicked
// element id; `canvas` is the empty-canvas right-click. Exported so
// the page can type its own context-menu state against it.
export type { EditorContextMenuState } from './EditorContextMenu.types';

export function EditorContextMenu(props: EditorContextMenuProps) {
  const { menu, elements, onClose } = props;
  const position = { x: menu.x, y: menu.y };
  // Revert any in-flight swatch / border / rotation hover preview if the menu
  // unmounts mid-hover (dismissed by click-away or Escape) — pointerleave won't
  // fire on unmount. The inline tiles below share this single safety net; the
  // preset rows + ColourRow also revert on their own pointerleave.
  useRevertOnUnmount(props.onPreviewStyleEnd);
  // Grow UPWARD when the menu is opened in the bottom fifth of the
  // viewport, so the tall collapsible-category menu opens above the
  // cursor instead of running off-screen — matching the tab menu.
  const anchorBottom = typeof window !== 'undefined' && menu.y > window.innerHeight * 0.8;
  // Accordion + colour-row scaffolding, shared with the multi-selection branch.
  const { sectionProps, colorProps, textColorHandlers, fillColorHandlers, strokeColorHandlers } =
    useContextMenuScaffold(props);
  // Session-tool pickers (spec/39): the chosen timer mode + countdown length
  // and the votes-per-person budget, local until the facilitator hits Start
  // (mirrors the old tab editor's Session accordion).

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
    // Regular shapes (not the dedicated icon glyph, not a frame container, not
    // a progress element which carries its own `progress` data) can morph to
    // another common kind in place.
    const isProgress = target.type === 'shape' && isProgressShape(target.shape);
    const isRail = target.type === 'shape' && isRailShape(target.shape);
    const isRating = target.type === 'shape' && isRatingShape(target.shape);
    const isChart = target.type === 'shape' && isChartShape(target.shape);
    const morphable =
      target.type === 'shape' &&
      !isIcon &&
      target.shape !== 'frame' &&
      !isProgress &&
      !isRail &&
      !isRating &&
      !isChart;
    // Consistent category grouping (spec/09): placement (Layer / Shape /
    // Rotation) · appearance (Progress / Animation / Colours / Border) ·
    // content (Line / Pointer / Text / Icon / Image / Table / Link) ·
    // collaboration. A group divider renders above a group only when that
    // group has a visible section, so an absent group never leaves a dangling
    // rule. Placement always shows (Layer is unconditional), so each later
    // group's divider just gates on the group's own visibility.
    const showContentGroup =
      target.type === 'arrow' ||
      target.type === 'table' ||
      target.type === 'image' ||
      target.type === 'link-card';
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
                  onClick={() => props.onSetShapeKind([target.id], kind)}
                  onPointerEnter={onMouseHover(() => props.onPreviewShapeKind([target.id], kind))}
                  onPointerLeave={onMouseHover(props.onPreviewStyleEnd)}
                >
                  <ShapeIcon kind={kind} />
                </SizeButton>
              ))}
            </div>
            <div className="px-2 pb-1.5 pt-0.5">
              <MenuActionButton
                label="Reset aspect ratio"
                onClick={() => {
                  props.onResetAspectRatio();
                  onClose();
                }}
              />
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
                  onClick={() => props.onCommitRotation(deg)}
                  onPointerEnter={onMouseHover(() => props.onPreviewRotation(deg))}
                  onPointerLeave={onMouseHover(props.onPreviewStyleEnd)}
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
        {/* ── Appearance group: Presets / Progress / Animation / Colours / Border ── */}
        <ElementAppearanceSections
          props={props}
          target={target}
          onClose={onClose}
          sectionProps={sectionProps}
          colorProps={colorProps}
          textColorHandlers={textColorHandlers}
          fillColorHandlers={fillColorHandlers}
          strokeColorHandlers={strokeColorHandlers}
        />
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
        <ElementContentSections
          props={props}
          target={target}
          onClose={onClose}
          hasImage={hasImage}
          hasLink={hasLink}
          showCollaborateGroup={showCollaborateGroup}
          sectionProps={sectionProps}
          colorProps={colorProps}
          textColorHandlers={textColorHandlers}
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
