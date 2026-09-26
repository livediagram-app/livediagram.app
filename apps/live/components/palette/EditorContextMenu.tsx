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
  EVENT_STORMING_NOTES,
  eventStormingKindOf,
  isFixedSizeElement,
  arrowheadShapeOf,
  arrowheadSizeOf,
  arrowRoutesBehind,
  arrowStyleOf,
  arrowThicknessOf,
  isBoxed,
  isSelfDrawingShape,
} from '@livediagram/diagram';
import { ArrowLineControls, ArrowPointerControls } from '@/components/canvas/arrow-controls';
import { ContextMenu, ContextMenuDivider } from '@/components/palette/ContextMenu';
import { SizeButton } from '@/components/palette/palette-controls';
import {
  LayerDownIcon,
  LayersGlyph,
  LayerUpIcon,
  LineGlyph,
  PointerGlyph,
  RotationGlyph,
  SizeMenuIcon,
  SquareMenuIcon,
  CopyIcon,
  CutIcon,
  DuplicateMenuIcon,
  RemoveIcon,
} from '@/components/palette/context-menu-icons';
import {
  MenuAccordionSection,
  MenuActionRow,
  MenuGroupSeparator,
  MenuTile,
  MenuTileGrid,
} from '@/components/primitives/PortalMenu';
import { ShapeIcon } from '@/components/primitives/shape-icon';
import { SizeSection } from '@/components/palette/SizeSection';

import { OpacityRow } from '@/components/palette/context-menu-rows';
import { MoveToLayerRow } from '@/components/palette/MoveToLayerRow';
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
  const {
    sectionProps,
    flyoutProps,
    colorProps,
    textColorHandlers,
    fillColorHandlers,
    headerFillHandlers,
    labelFillHandlers,
    arrowheadColorHandlers,
    strokeColorHandlers,
  } = useContextMenuScaffold(props);
  // Session-tool pickers (docs/specs/012-collaboration/session-tools.md): the chosen timer mode + countdown length
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
    // a self-drawing data shape which carries its own data) can morph to
    // another common kind in place.
    const morphable =
      target.type === 'shape' &&
      !isIcon &&
      target.shape !== 'frame' &&
      // Every self-drawing kind carries its own data (progress / rail /
      // rating / charts / code block / checklist), so none of them morph.
      !isSelfDrawingShape(target.shape);
    // Consistent category grouping (docs/specs/008-canvas/canvas-and-palette.md): placement (Layer / Shape /
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
      target.type === 'link-card' ||
      target.type === 'video';
    const showCollaborateGroup = boxed;
    // An event-storming note (docs/specs/021-event-storming/event-storming.md) gets a VERB menu, not a styling one:
    // its colour, silhouette, text treatment and tilt are the notation, so
    // Colours / Shadow / Animation / Text / Rotation / Layer have nothing
    // meaningful to offer — they would only invite someone to break the
    // grammar. What a facilitator actually reaches for mid-workshop is
    // cut / copy / duplicate / remove and the stacking pair.
    const esNote = eventStormingKindOf(target) !== null;
    // A verb runs, then the menu gets out of the way (see the rows below).
    const runAndClose = (action: () => void) => () => {
      action();
      onClose();
    };
    return (
      <ContextMenu position={position} onClose={onClose} flush anchorBottom={anchorBottom}>
        {/* Layer — pinned FIRST in the menu (before the type-specific
            categories, which render conditionally and so would otherwise
            shuffle Layer's position around). Groups front/back + opacity +
            (for boxed elements) the aspect-ratio lock. */}
        {esNote ? (
          <>
            {/* Every verb closes the menu: an action ANSWERS the question the
                right-click asked, so leaving the menu up means the user has to
                dismiss a menu that has already done its job — and it covers
                the very element they just acted on, hiding the result. */}
            <MenuActionRow
              icon={<CutIcon />}
              label="Cut"
              onClick={runAndClose(props.onCutElement)}
            />
            <MenuActionRow
              icon={<CopyIcon />}
              label="Copy"
              onClick={runAndClose(props.onCopyElement)}
            />
            <MenuActionRow
              icon={<DuplicateMenuIcon />}
              label="Duplicate"
              onClick={runAndClose(props.onDuplicateElement)}
            />
            <MenuGroupSeparator />
            <MenuActionRow
              icon={<LayerUpIcon />}
              label="Bring to Front"
              onClick={runAndClose(props.onStackFront)}
            />
            <MenuActionRow
              icon={<LayerDownIcon />}
              label="Send to Back"
              onClick={runAndClose(props.onStackBack)}
            />
            {/* Change kind (docs/specs/021-event-storming/event-storming.md): the ONE styling-shaped thing this menu
                offers, because on this board the kind is not styling — it is
                what the note MEANS. Re-paints, re-cuts the silhouette and
                leaves the note centred where it was. */}
            {props.onSetEsKind ? (
              <>
                <MenuGroupSeparator />
                <MenuAccordionSection
                  title="Change kind"
                  icon={<SquareMenuIcon />}
                  {...sectionProps('es-kind')}
                >
                  <MenuTileGrid cols={2}>
                    {EVENT_STORMING_NOTES.map((n) => (
                      <MenuTile
                        key={n.kind}
                        icon={
                          <span
                            aria-hidden
                            className="block h-3 w-3 rounded-[2px] border border-black/10"
                            style={{ backgroundColor: n.fill }}
                          />
                        }
                        label={n.label}
                        onClick={runAndClose(() => props.onSetEsKind?.(n.kind))}
                      />
                    ))}
                  </MenuTileGrid>
                </MenuAccordionSection>
              </>
            ) : null}
            <MenuGroupSeparator />
            <MenuActionRow
              icon={<RemoveIcon />}
              label="Remove"
              danger
              onClick={runAndClose(props.onDeleteElement)}
            />
          </>
        ) : null}
        {esNote ? null : (
          <MenuAccordionSection title="Layer" icon={<LayersGlyph />} {...sectionProps('layer')}>
            {/* Layer order tweaks keep the menu open so you can nudge
              front/back a few times in a row. */}
            <MenuTileGrid cols={2}>
              <MenuTile
                icon={<LayerUpIcon />}
                label="Bring to Front"
                onClick={props.onBringToFront}
              />
              <MenuTile
                icon={<LayerDownIcon />}
                label="Send to Back"
                onClick={props.onSendToBack}
              />
            </MenuTileGrid>
            {/* Move to a named layer (docs/specs/006-diagram/layers.md) — only once the tab has
              more than one layer (the row renders nothing otherwise). */}
            <MoveToLayerRow
              layers={props.layers}
              elements={props.elements}
              tabFont={props.tabFont}
              currentLayerId={props.selectionLayerId}
              onMove={props.onMoveSelectionToLayer}
            />
            <ContextMenuDivider />
            {/* Opacity slider — a non-closing row (dragging stays inside the
              menu, so the outside-click guard leaves it open). */}
            <OpacityRow
              value={(target as { opacity?: number }).opacity ?? 1}
              onChange={props.onSetOpacity}
            />
          </MenuAccordionSection>
        )}
        {/* Size — the exact box (docs/specs/008-canvas/element-size.md). Gathers the three controls that
            all answer "how big is this": the width / height boxes, the aspect
            lock (which lived in Layer) and the reset (which lived in Shape,
            so it only appeared for morphable kinds). */}
        {/* Fixed-size elements (docs/specs/009-elements/mode-button.md buttons, docs/specs/021-event-storming/event-storming.md event-storming
            notes) have no size to edit — offering the boxes would advertise
            a resize the drag paths deliberately ignore. */}
        {boxed && !isFixedSizeElement(target) ? (
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
          </MenuAccordionSection>
        ) : null}
        {/* Rotation — fixed snap angles. Each tile previews the orientation
            (an upright marker rotated by the angle) so the effect is legible
            before clicking; 0° resets to upright. */}
        {boxed && !esNote ? (
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
        {/* ── Appearance group: Presets / Progress / Animation / Colours / Border ──
            Skipped entirely for an event-storming note: its colour, text
            treatment and shadow are the notation (docs/specs/021-event-storming/event-storming.md), so every
            control in here would only invite breaking the grammar. */}
        {esNote ? null : (
          <ElementAppearanceSections
            props={props}
            target={target}
            onClose={onClose}
            sectionProps={sectionProps}
            flyoutProps={flyoutProps}
            colorProps={colorProps}
            textColorHandlers={textColorHandlers}
            fillColorHandlers={fillColorHandlers}
            headerFillHandlers={headerFillHandlers}
            arrowheadColorHandlers={arrowheadColorHandlers}
            strokeColorHandlers={strokeColorHandlers}
          />
        )}
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
                  routeBehind={arrowRoutesBehind(target)}
                  onSetThickness={props.onSetArrowThickness}
                  onSetStyle={props.onSetArrowStyle}
                  onSetStrokeStyle={props.onSetArrowStrokeStyle}
                  onSetRouteBehind={props.onSetArrowRouteBehind}
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
          labelFillHandlers={labelFillHandlers}
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
