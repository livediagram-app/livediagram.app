import {
  rotationOf,
  supportsRotation,
  type BoxedElement,
  type Element,
  type ShapeElement,
} from '@livehuddle/document';
import { ContextMenuDivider } from '@liveworkspace/workbench/components/palette/ContextMenu';
import { onMouseHover } from '@liveworkspace/workbench/components/primitives/hover-preview';
import { SizeButton } from '@/components/palette/palette-controls';
import {
  AspectLockMenuIcon,
  LayerDownIcon,
  LayersGlyph,
  LayerUpIcon,
  RotationGlyph,
  RotationMenuIcon,
} from '@/components/palette/context-menu-icons';
import {
  MenuAccordionSection,
  MenuActionButton,
} from '@liveworkspace/workbench/components/primitives/PortalMenu';
import { MenuTile, MenuTileGrid } from '@liveworkspace/workbench/components/primitives/MenuTiles';
import { OpacityRow } from '@/components/palette/context-menu-rows';
import { ROTATION_ANGLES } from './context-menu-constants';
import type { EditorContextMenuProps } from './EditorContextMenu.types';
import type { useContextMenuScaffold } from './useContextMenuScaffold';
import { Switch } from '@livehuddle/ui';

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
  // The members that turn: a pointer note or an annotation marker does not (supportsRotation), so a selection of only
  // those offers no Rotation, and the active tile reads a member that turns.
  const turnable = boxedSel.filter(supportsRotation);
  return (
    <>
      {/* Arrange: front/back, opacity and (for boxed members) the aspect-ratio lock, selection-wide,
          mirroring the single menu's pinned-first Arrange section. */}
      <MenuAccordionSection title="Arrange" icon={<LayersGlyph />} {...sectionProps('m-layer')}>
        <MenuTileGrid cols={2}>
          <MenuTile icon={<LayerUpIcon />} label="Bring to Front" onClick={props.onBringToFront} />
          <MenuTile icon={<LayerDownIcon />} label="Send to Back" onClick={props.onSendToBack} />
        </MenuTileGrid>
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
                Lock Aspect Ratio
              </span>
              <Switch presentational size="sm" checked={!!boxedSel[0]!.aspectLocked} />
            </button>
          </>
        ) : null}
        {/* The shapes' Reset Aspect Ratio, which the Shape section held while the diagram shapes could be morphed
            between (docs/specs/002-project-scope/not-in-livehuddle.md "The element engine", part 5). */}
        {morphable.length ? (
          <div className="px-2 pb-1.5 pt-0.5">
            <MenuActionButton
              label="Reset Aspect Ratio"
              onClick={() => {
                props.onResetAspectRatio();
                onClose();
              }}
            />
          </div>
        ) : null}
      </MenuAccordionSection>
      {/* Rotation — snap angles for every boxed member. */}
      {turnable.length ? (
        <MenuAccordionSection
          title="Rotation"
          icon={<RotationMenuIcon />}
          {...sectionProps('m-rotation')}
        >
          <div className="grid grid-cols-4 gap-1 px-2 py-1.5">
            {ROTATION_ANGLES.map((deg) => (
              <SizeButton
                key={deg}
                active={rotationOf(turnable[0]!) % 360 === deg}
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
