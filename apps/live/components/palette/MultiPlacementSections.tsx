import type { BoxedElement, Element, ShapeElement } from '@livediagram/diagram';
import { ToggleSwitch } from '@/components/palette/palette-controls';
import { onMouseHover } from '@/components/primitives/hover-preview';
import { SizeButton } from '@/components/palette/palette-controls';
import {
  AspectLockMenuIcon,
  LayerDownIcon,
  LayersGlyph,
  LayerUpIcon,
  RotationGlyph,
  SquareMenuIcon,
} from '@/components/palette/context-menu-icons';
import { MenuAccordionSection, MenuTile, MenuTileGrid } from '@/components/primitives/PortalMenu';
import { OpacityRow } from '@/components/palette/context-menu-rows';
import { ShapeIcon } from '@/components/primitives/shape-icon';
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
}: {
  props: EditorContextMenuProps;
  sel: Element[];
  boxedSel: BoxedElement[];
  morphable: ShapeElement[];
  sectionProps: Scaffold['sectionProps'];
}) {
  const morphSrc = morphable[0];
  const morphIds = morphable.map((el) => el.id);
  return (
    <>
      {/* Layer — front/back, opacity and (for boxed members) the
                  aspect-ratio lock, selection-wide, mirroring the single
                  menu's pinned-first Layer section. */}
      <MenuAccordionSection title="Layer" icon={<LayersGlyph />} {...sectionProps('m-layer')}>
        <MenuTileGrid cols={2}>
          <MenuTile icon={<LayerUpIcon />} label="Bring to Front" onClick={props.onBringToFront} />
          <MenuTile icon={<LayerDownIcon />} label="Send to Back" onClick={props.onSendToBack} />
        </MenuTileGrid>
        <OpacityRow
          value={(sel[0] as { opacity?: number } | undefined)?.opacity ?? 1}
          onChange={props.onSetOpacity}
        />
        {boxedSel.length ? (
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
        ) : null}
      </MenuAccordionSection>
      {/* Shape — morph every morphable member to a common kind. */}
      {morphSrc ? (
        <MenuAccordionSection title="Shape" icon={<SquareMenuIcon />} {...sectionProps('m-shape')}>
          <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
            {COMMON_SHAPES.map((kind) => (
              <SizeButton
                key={kind}
                active={morphSrc.shape === kind}
                onClick={() => props.onSetShapeKind(morphIds, kind)}
                onPointerEnter={onMouseHover(() => props.onPreviewShapeKind(morphIds, kind))}
                onPointerLeave={onMouseHover(props.onPreviewStyleEnd)}
              >
                <ShapeIcon kind={kind} />
              </SizeButton>
            ))}
          </div>
        </MenuAccordionSection>
      ) : null}
      {/* Rotation — snap angles for every boxed member. */}
      {boxedSel.length ? (
        <MenuAccordionSection
          title="Rotation"
          icon={<RotationGlyph deg={45} />}
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
