'use client';

import type { PathAnchor, PathElement } from '@livediagram/document';
import { visibleHandles, type HandleSide } from '@/lib/path-edit';
import { HandleMarker, NodeMarker, OVERLAY_SVG_CLASS, PATH_OVERLAY_Z } from './path-markers';
import type { PathGuides } from './usePathEditGesture';

type Point = { x: number; y: number };

export type PathEditView = {
  // The path's committed frame: its box and rotation, which the anchors are drawn in.
  frame: Pick<PathElement, 'x' | 'y' | 'width' | 'height' | 'rotation'>;
  anchors: readonly PathAnchor[];
  closed: boolean;
  selected: ReadonlySet<number>;
  box: { from: Point; to: Point } | null;
  guides: PathGuides | null;
  zoom: number;
};

// How far a snap guide runs past the path's nodes, in screen px.
const GUIDE_OVERHANG_PX = 24;

// A path's edit mode on the canvas (docs/specs/023-whiteboard/path-tool.md "Editing"; blueprint
// path-tool "Rendering"): every node, the handles of the selected nodes and their neighbours' facing
// sides, the snap guides and the node box, drawn in the transformed layer and turned with the path.
// It takes no pointer: presses are hit-tested by usePathEditGesture.
export function PathEditLayer({
  frame,
  anchors,
  closed,
  selected,
  box,
  guides,
  zoom,
}: PathEditView) {
  const rotation = frame.rotation ?? 0;
  const cx = frame.x + frame.width / 2;
  const cy = frame.y + frame.height / 2;
  const handles = new Map<number, HandleSide[]>();
  for (const h of visibleHandles(anchors, closed, selected)) {
    handles.set(h.node, [...(handles.get(h.node) ?? []), h.side]);
  }
  const xs = anchors.map((a) => a.x);
  const ys = anchors.map((a) => a.y);
  const over = GUIDE_OVERHANG_PX / zoom;
  return (
    <svg
      className={OVERLAY_SVG_CLASS}
      style={{ zIndex: PATH_OVERLAY_Z }}
      aria-hidden
      data-path-edit=""
    >
      <g transform={rotation % 360 !== 0 ? `rotate(${rotation} ${cx} ${cy})` : undefined}>
        {guides?.x !== undefined ? (
          <line
            data-path-guide="x"
            x1={guides.x}
            x2={guides.x}
            y1={Math.min(...ys) - over}
            y2={Math.max(...ys) + over}
            strokeWidth={1 / zoom}
            className="stroke-brand-500"
          />
        ) : null}
        {guides?.y !== undefined ? (
          <line
            data-path-guide="y"
            y1={guides.y}
            y2={guides.y}
            x1={Math.min(...xs) - over}
            x2={Math.max(...xs) + over}
            strokeWidth={1 / zoom}
            className="stroke-brand-500"
          />
        ) : null}
        {[...handles].map(([node, sides]) => (
          <HandleMarker key={node} anchor={anchors[node]!} zoom={zoom} sides={sides} />
        ))}
        {anchors.map((a, i) => (
          <NodeMarker
            key={i}
            at={a}
            zoom={zoom}
            corner={a.mode === 'corner'}
            selected={selected.has(i)}
          />
        ))}
      </g>
      {box ? (
        <rect
          data-path-box=""
          x={Math.min(box.from.x, box.to.x)}
          y={Math.min(box.from.y, box.to.y)}
          width={Math.abs(box.to.x - box.from.x)}
          height={Math.abs(box.to.y - box.from.y)}
          strokeWidth={1 / zoom}
          strokeDasharray={`${4 / zoom} ${3 / zoom}`}
          className="fill-brand-500/[0.08] stroke-brand-500"
        />
      ) : null}
    </svg>
  );
}
