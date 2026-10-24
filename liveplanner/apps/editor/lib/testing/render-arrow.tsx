import { elementGridFor, type ArrowElement } from '@liveplanner/project';
import type { ArrowLabelRender } from '@/hooks/canvas/useArrowLabelLayouts';
import { ArrowView } from '@/components/canvas/ArrowView';
import { arrowViewGeometry } from '@/components/canvas/arrow-view-frame';

const NO_LABEL: ArrowLabelRender = { layout: null, knockouts: [] };
const noop = () => {};

// One arrow as the canvas's element layer draws it, selected and with no grips, for the arrowhead tests.
export function ArrowForTests({ arrow }: { arrow: ArrowElement }) {
  const geometry = arrowViewGeometry(arrow, new Map(), elementGridFor([]));
  return (
    <svg>
      <ArrowView
        arrow={arrow}
        frame={geometry.frame}
        holes={geometry.holes}
        labelRender={NO_LABEL}
        draftLayout={() => null}
        isSelected
        isPaintMode={false}
        isEditing={false}
        tabLocked={false}
        readOnly
        onSelect={noop}
        onContextSelect={noop}
        onBeginEndpointDrag={noop}
        onBeginEdit={noop}
        onCommitLabel={noop}
      />
    </svg>
  );
}
