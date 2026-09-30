import type { ArrowElement, ArrowLabelLayout, Element, ElementIndex } from '@livediagram/document';
import type { ArrowLabelRender } from '@/hooks/canvas/useArrowLabelLayouts';
import { ArrowDefs } from '@/components/canvas/arrow-defs';
import { ArrowView } from '@/components/canvas/ArrowView';

// A drawn arrow has no label while it is being drawn.
const NO_LABEL: ArrowLabelRender = { layout: null, knockouts: [] };
const noop = () => {};

// The line or arrow a draw gesture will land, while the drag is in flight (docs/specs/023-whiteboard/whiteboard.md
// "Shapes"): the very element the release commits (buildDressedDrawnArrow), drawn by ArrowView in the
// canvas's transformed layer after every element, where the committed arrow lands. It draws as it
// lands, selected, so release changes no pixel of it; only the grips arrive with the release. The
// preview takes no pointer, so the draw keeps its cursor and nothing under it reacts.
export function DrawnArrowPreview({
  arrow,
  elementIndex,
  occluders,
  draftLayout,
  fontFamily,
  withDefs,
}: {
  arrow: ArrowElement;
  // What the arrow's ends resolve against (an end snapped onto another arrow).
  elementIndex: ElementIndex;
  // The boxes the canvas draws, which the line passes behind as the committed one will.
  occluders: readonly Element[];
  draftLayout: (arrow: ArrowElement, text: string) => ArrowLabelLayout | null;
  fontFamily?: string;
  // The shared arrowhead markers, when no arrow on the board has mounted them yet.
  withDefs: boolean;
}) {
  return (
    <svg
      data-arrow-draw-preview=""
      aria-hidden
      className="absolute inset-0 h-full w-full [&_*]:!pointer-events-none"
      style={{ pointerEvents: 'none', overflow: 'visible' }}
    >
      {withDefs ? <ArrowDefs /> : null}
      <ArrowView
        arrow={arrow}
        elementIndex={elementIndex}
        occluders={occluders}
        labelRender={NO_LABEL}
        draftLayout={draftLayout}
        isSelected
        isPaintMode={false}
        isEditing={false}
        tabLocked={false}
        // No grips on a preview.
        readOnly
        onSelect={noop}
        onContextSelect={noop}
        onBeginEndpointDrag={noop}
        onBeginEdit={noop}
        onCommitLabel={noop}
        onCancelEdit={noop}
        fontFamily={fontFamily}
      />
    </svg>
  );
}
