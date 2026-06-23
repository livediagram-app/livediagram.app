// Shared Line + Pointer controls for arrows. Rendered inside the editor
// context menu's Line / Pointer categories (kept as a standalone, reusable
// unit so a second caller can drop them in without duplication, per
// CLAUDE.md). Pure presentation: values in, setters out. Each sub-grid
// is gated on its value being non-null, so a caller can pass null to hide a
// row (the context menu does this for elements that don't carry that field).

import {
  ARROW_THICKNESS_PX,
  ARROWHEAD_SHAPES,
  ARROWHEAD_SIZE_PX,
  type ArrowEnds,
  type ArrowheadShape,
  type ArrowheadSize,
  type ArrowStyle,
  type ArrowThickness,
  type BorderStyle,
} from '@livediagram/diagram';
import { SizeButton } from '@/components/palette/palette-controls';
import {
  ArrowEndsIcon,
  ArrowheadShapeIcon,
  ArrowheadSizeIcon,
  ArrowStyleIcon,
  BorderStyleIcon,
  ThicknessIcon,
} from '@/components/palette/palette-icons';
import { Tooltip } from '@/components/primitives/Tooltip';

const LINE_PATTERN_ORDER: readonly BorderStyle[] = [
  'solid',
  'dashed',
  'dotted',
  'dash-dot',
  'long-dash',
  'dash-dot-dot',
];

const LINE_PATTERN_LABEL: Record<BorderStyle, string> = {
  solid: 'Solid',
  dashed: 'Dashed',
  dotted: 'Dotted',
  'dash-dot': 'Dash-dot',
  'long-dash': 'Long dash',
  'dash-dot-dot': 'Dash-dot-dot',
};

const ARROWHEAD_SHAPE_LABEL: Record<ArrowheadShape, string> = {
  triangle: 'Filled triangle',
  'triangle-hollow': 'Hollow triangle',
  line: 'Open',
  circle: 'Dot',
  'circle-hollow': 'Hollow dot',
  diamond: 'Filled diamond',
  'diamond-hollow': 'Hollow diamond',
};

const ARROWHEAD_SHAPE_DESC: Record<ArrowheadShape, string> = {
  triangle: 'The classic filled arrowhead.',
  'triangle-hollow': 'A hollow triangle: UML inheritance / "is a".',
  line: 'An open V with no fill: dependency / flow.',
  circle: 'A filled dot terminator.',
  'circle-hollow': 'A hollow dot terminator.',
  diamond: 'A filled diamond: UML composition.',
  'diamond-hollow': 'A hollow diamond: UML aggregation.',
};

const subLabel = 'text-[10px] font-medium text-slate-500 dark:text-slate-400';
const divider = 'my-2 h-px bg-slate-100 dark:bg-slate-800';

// Line: thickness + line style + line (dash) pattern. Each row hidden when
// its value is null.
export function ArrowLineControls({
  thickness,
  style,
  strokeStyle,
  onSetThickness,
  onSetStyle,
  onSetStrokeStyle,
}: {
  thickness: ArrowThickness | null;
  style: ArrowStyle | null;
  strokeStyle: BorderStyle | null;
  onSetThickness: (v: ArrowThickness) => void;
  onSetStyle: (v: ArrowStyle) => void;
  onSetStrokeStyle: (v: BorderStyle) => void;
}) {
  return (
    <>
      {thickness !== null ? (
        <>
          <p className={subLabel}>Thickness</p>
          <div className="mt-1 grid grid-cols-4 gap-1">
            {(
              [
                ['thin', 'Thin'],
                ['medium', 'Medium'],
                ['thick', 'Thick'],
                ['extra-thick', 'Extra thick'],
              ] as [ArrowThickness, string][]
            ).map(([id, label]) => (
              <Tooltip
                key={id}
                title={label}
                description={`Sets the arrow stroke width to ${ARROW_THICKNESS_PX[id]}px.`}
              >
                <SizeButton active={thickness === id} onClick={() => onSetThickness(id)}>
                  <ThicknessIcon px={ARROW_THICKNESS_PX[id]} />
                </SizeButton>
              </Tooltip>
            ))}
          </div>
        </>
      ) : null}
      {style !== null ? (
        <>
          {thickness !== null ? <div className={divider} /> : null}
          <p className={subLabel}>Line style</p>
          <div className="mt-1 grid grid-cols-3 gap-1">
            {(
              [
                ['straight', 'Straight', 'Plain straight line, the default.'],
                ['curved', 'Curved', 'Smooth bezier curve bowing perpendicular to the endpoints.'],
                ['angled', 'Angled', 'Axis-aligned L-connector with a single right-angle bend.'],
              ] as [ArrowStyle, string, string][]
            ).map(([id, label, desc]) => (
              <Tooltip key={id} title={label} description={desc}>
                <SizeButton active={style === id} onClick={() => onSetStyle(id)}>
                  <ArrowStyleIcon style={id} />
                </SizeButton>
              </Tooltip>
            ))}
          </div>
        </>
      ) : null}
      {strokeStyle !== null ? (
        <>
          {thickness !== null || style !== null ? <div className={divider} /> : null}
          <p className={subLabel}>Line pattern</p>
          <div className="mt-1 grid grid-cols-3 gap-1">
            {LINE_PATTERN_ORDER.map((value) => (
              <Tooltip
                key={value}
                block
                title={LINE_PATTERN_LABEL[value]}
                description={`Line pattern: ${LINE_PATTERN_LABEL[value].toLowerCase()}.`}
              >
                <SizeButton active={strokeStyle === value} onClick={() => onSetStrokeStyle(value)}>
                  <BorderStyleIcon value={value} />
                </SizeButton>
              </Tooltip>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}

// Pointer: which end(s) have a head + (when any) head size + head shape.
export function ArrowPointerControls({
  ends,
  headSize,
  headShape,
  onSetEnds,
  onSetHeadSize,
  onSetHeadShape,
}: {
  ends: ArrowEnds;
  headSize: ArrowheadSize | null;
  headShape: ArrowheadShape | null;
  onSetEnds: (v: ArrowEnds) => void;
  onSetHeadSize: (v: ArrowheadSize) => void;
  onSetHeadShape: (v: ArrowheadShape) => void;
}) {
  return (
    <>
      <p className={subLabel}>Pick which end(s) of the arrow have a pointer.</p>
      <div className="mt-1 grid grid-cols-4 gap-1">
        {(
          [
            ['from', 'Start only', 'Arrowhead on the left / starting end only.'],
            ['to', 'End only', 'Arrowhead on the right / ending end only (the default).'],
            ['both', 'Both ends', 'Arrowheads on both ends (a two-way connector).'],
            ['none', 'No pointers', 'No arrowhead on either end: a plain connector / line.'],
          ] as [ArrowEnds, string, string][]
        ).map(([id, label, desc]) => (
          <Tooltip key={id} title={label} description={desc}>
            <SizeButton active={ends === id} onClick={() => onSetEnds(id)}>
              <ArrowEndsIcon ends={id} />
            </SizeButton>
          </Tooltip>
        ))}
      </div>
      {headSize !== null && ends !== 'none' ? (
        <>
          <div className={divider} />
          <p className={subLabel}>Arrowhead size</p>
          <div className="mt-1 grid grid-cols-4 gap-1">
            {(
              [
                ['small', 'Small'],
                ['medium', 'Medium'],
                ['large', 'Large'],
                ['extra-large', 'Extra large'],
              ] as [ArrowheadSize, string][]
            ).map(([id, label]) => (
              <Tooltip
                key={id}
                title={label}
                description={`Marker size ${ARROWHEAD_SIZE_PX[id]}, independent of line thickness.`}
              >
                <SizeButton active={headSize === id} onClick={() => onSetHeadSize(id)}>
                  <ArrowheadSizeIcon px={ARROWHEAD_SIZE_PX[id]} />
                </SizeButton>
              </Tooltip>
            ))}
          </div>
        </>
      ) : null}
      {headShape !== null && ends !== 'none' ? (
        <>
          <div className={divider} />
          <p className={subLabel}>Arrowhead shape</p>
          <div className="mt-1 grid grid-cols-4 gap-1">
            {ARROWHEAD_SHAPES.map((shape) => (
              <Tooltip
                key={shape}
                title={ARROWHEAD_SHAPE_LABEL[shape]}
                description={ARROWHEAD_SHAPE_DESC[shape]}
              >
                <SizeButton active={headShape === shape} onClick={() => onSetHeadShape(shape)}>
                  <ArrowheadShapeIcon shape={shape} />
                </SizeButton>
              </Tooltip>
            ))}
          </div>
        </>
      ) : null}
    </>
  );
}
