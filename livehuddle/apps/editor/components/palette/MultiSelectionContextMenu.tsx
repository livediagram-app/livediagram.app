import {
  isBoxed,
  isRetiredElement,
  isSelfDrawingShape,
  type ShapeElement,
} from '@livehuddle/document';
import { ContextMenu } from '@liveworkspace/workbench/components/palette/ContextMenu';
import type { EditorContextMenuProps } from './EditorContextMenu.types';
import { MultiPlacementSections } from './MultiPlacementSections';
import { PieceTypeMenuSection } from './PieceTypeMenuSection';
import { selectionTypeTarget } from './piece-type-tiles';
import { useContextMenuScaffold } from './useContextMenuScaffold';

type MultiSelectionContextMenuProps = {
  props: EditorContextMenuProps;
  position: { x: number; y: number };
  onClose: () => void;
  anchorBottom: boolean;
};

// The whole-selection ('multi') context menu: Size (the aspect lock and, for shapes, Reset Aspect Ratio) and the
// right-clicked piece's Type. Its Arrange, Rotation, Appearance and Text sections left livehuddle
// (docs/specs/002-project-scope/not-in-livehuddle.md "Element looks, layers, opacity and rotation"); with neither
// section to show it opens nothing. The selection toolbar carries Duplicate / Export / Delete.
export function MultiSelectionContextMenu({
  props,
  position,
  onClose,
  anchorBottom,
}: MultiSelectionContextMenuProps) {
  const { sectionProps } = useContextMenuScaffold();
  const all = props.selectionElements;
  // A retired member (docs/specs/002-project-scope/not-in-livehuddle.md "Retired elements") keeps its size and kind
  // as stored, so the Size section and the Type read only the members livehuddle still has.
  const sel = all.filter((el) => !isRetiredElement(el));
  const boxedSel = sel.filter(isBoxed);
  const morphable = boxedSel.filter(
    (el) => el.type === 'shape' && el.shape !== 'icon' && !isSelfDrawingShape(el.shape),
  ) as ShapeElement[];
  const typeTarget = selectionTypeTarget(
    sel,
    props.menu.mode === 'multi' ? props.menu.elementId : undefined,
  );
  const showType = !!typeTarget && !!props.onSetPieceType;
  if (!boxedSel.length && !showType) return null;
  return (
    <ContextMenu
      position={position}
      label="Selection menu"
      onClose={onClose}
      flush
      anchorBottom={anchorBottom}
    >
      <MultiPlacementSections
        props={props}
        boxedSel={boxedSel}
        morphable={morphable}
        sectionProps={sectionProps}
        onClose={onClose}
      />
      {/* The right-clicked piece's Type (docs/specs/009-elements/office.md "A piece's type"): picking one retypes
          every selected piece of its kind, and leaves the rest of the selection alone. */}
      {showType && typeTarget ? (
        <PieceTypeMenuSection
          target={typeTarget}
          elements={props.elements}
          sectionProps={sectionProps}
          onSetType={props.onSetPieceType!}
        />
      ) : null}
    </ContextMenu>
  );
}
