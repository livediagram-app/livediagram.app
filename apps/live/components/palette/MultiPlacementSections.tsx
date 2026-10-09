import { CombineOpGlyph, CombineTiles } from '@/components/canvas/CombineMenu';
import { MirrorCopyGlyph } from '@/components/canvas/logo-glyphs';
import type { BoxedElement, Element, ShapeElement } from '@livediagram/document';
import { ContextMenuDivider } from '@/components/palette/ContextMenu';
import { ToggleSwitch } from '@/components/palette/palette-controls';
import { onMouseHover } from '@/components/primitives/hover-preview';
import { SizeButton } from '@/components/palette/palette-controls';
import {
  AspectLockMenuIcon,
  LayerDownIcon,
  LayersGlyph,
  LayerUpIcon,
  RotationGlyph,
  RotationMenuIcon,
  SquareMenuIcon,
} from '@/components/palette/context-menu-icons';
import {
  MenuAccordionSection,
  MenuActionButton,
  MenuActionRow,
} from '@/components/primitives/PortalMenu';
import { MenuTile, MenuTileGrid } from '@/components/primitives/MenuTiles';
import { OpacityRow } from '@/components/palette/context-menu-rows';
import { MoveToLayerRow } from '@/components/palette/MoveToLayerRow';
import { ShapeIcon } from '@/components/primitives/shape-icon';
import { shapeKindLabel } from '@/lib/element-names';
import { COMMON_SHAPES, ROTATION_ANGLES } from './context-menu-constants';
import type { EditorContextMenuProps } from './EditorContextMenu.types';
import type { useContextMenuScaffold } from './useContextMenuScaffold';

type Scaffold = ReturnType<typeof useContextMenuScaffold>;

// The multi-selection menu's placement group (Layer / Shape / Rotation),
// split out of MultiSelectionContextMenu: front/back + opacity + the
// aspect lock, the morph-to-a-common-kind grid, and the snap-angle
// rotation tiles — each reading its display value off the first
// matching member and writing selection-wide, like the host's other
// section files.
export function MultiPlacementSections({
  props,
  sel,
  boxedSel,
  morphable,
  sectionProps,
  onClose,
}: {
  props: EditorContextMenuProps;
  sel: Element[];
  boxedSel: BoxedElement[];
  morphable: ShapeElement[];
  sectionProps: Scaffold['sectionProps'];
  onClose: () => void;
}) {
  const morphSrc = morphable[0];
  const morphIds = morphable.map((el) => el.id);
  return (
    <>
      {/* Combine (docs/specs/007-editor/logo-pages.md "Combine"): shapes on a logo page into one. */}
      {props.onCombine ? (
        <MenuAccordionSection
          title="Combine"
          icon={<CombineOpGlyph op="unite" size={16} />}
          {...sectionProps('m-combine')}
        >
          <CombineTiles
            onCombine={(op) => {
              onClose();
              props.onCombine!(op);
            }}
          />
        </MenuAccordionSection>
      ) : null}
      {/* Mirror Copy on a logo page (docs/specs/007-editor/logo-pages.md "Mirror"). */}
      {props.onMirrorCopy ? (
        <MenuActionRow
          icon={<MirrorCopyGlyph />}
          label="Mirror Copy"
          onClick={() => {
            onClose();
            props.onMirrorCopy!();
          }}
        />
      ) : null}
      {/* Layer — front/back, opacity and (for boxed members) the
                  aspect-ratio lock, selection-wide, mirroring the single
                  menu's pinned-first Layer section. */}
      <MenuAccordionSection title="Layer" icon={<LayersGlyph />} {...sectionProps('m-layer')}>
        <MenuTileGrid cols={2}>
          <MenuTile icon={<LayerUpIcon />} label="Bring to Front" onClick={props.onBringToFront} />
          <MenuTile icon={<LayerDownIcon />} label="Send to Back" onClick={props.onSendToBack} />
        </MenuTileGrid>
        {/* Move the whole selection to a named layer (docs/specs/006-document/layers.md). */}
        {props.onMoveSelectionToLayer ? (
          <MoveToLayerRow
            layers={props.layers}
            elements={props.elements}
            tabFont={props.tabFont}
            currentLayerId={props.selectionLayerId}
            onMove={props.onMoveSelectionToLayer}
          />
        ) : null}
        <ContextMenuDivider />
        <OpacityRow
          value={(sel[0] as { opacity?: number } | undefined)?.opacity ?? 1}
          onChange={props.onSetOpacity}
        />
        {boxedSel.length ? (
          <>
            <ContextMenuDivider />
            <button
              type="button"
              onClick={props.onToggleAspectLock}
              aria-pressed={!!boxedSel[0]!.aspectLocked}
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
                checked={!!boxedSel[0]!.aspectLocked}
                label="Lock aspect ratio"
              />
            </button>
          </>
        ) : null}
      </MenuAccordionSection>
      {/* Shape — morph every morphable member to a common kind. */}
      {morphSrc ? (
        <MenuAccordionSection title="Shape" icon={<SquareMenuIcon />} {...sectionProps('m-shape')}>
          <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
            {COMMON_SHAPES.map((kind) => (
              <SizeButton
                key={kind}
                label={shapeKindLabel(kind)}
                active={morphSrc.shape === kind}
                onClick={() => props.onSetShapeKind(morphIds, kind)}
                onPointerEnter={onMouseHover(() => props.onPreviewShapeKind(morphIds, kind))}
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
      {/* Rotation — snap angles for every boxed member. */}
      {boxedSel.length ? (
        <MenuAccordionSection
          title="Rotation"
          icon={<RotationMenuIcon />}
          {...sectionProps('m-rotation')}
        >
          <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
            {ROTATION_ANGLES.map((deg) => (
              <SizeButton
                key={deg}
                active={(boxedSel[0]!.rotation ?? 0) % 360 === deg}
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
    </>
  );
}
