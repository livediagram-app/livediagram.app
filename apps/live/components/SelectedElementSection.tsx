import {
  Accordion,
  AlignmentGrid,
  ColorSwatch,
  LabelButton,
  SizeButton,
  ToggleSwitch,
} from './palette-controls';
import type {
  ArrowheadShape,
  ArrowheadSize,
  ArrowStyle,
  ArrowThickness,
  BorderRadius,
  BorderStroke,
  BorderStyle,
  ShapeKind,
} from '@livediagram/diagram';
import { ARROW_THICKNESS_PX, ARROWHEAD_SHAPES, ARROWHEAD_SIZE_PX } from '@livediagram/diagram';
import {
  ArrowEndsIcon,
  ArrowheadShapeIcon,
  ArrowheadSizeIcon,
  ArrowStyleIcon,
  BoldIcon,
  BorderRadiusIcon,
  BorderStrokeIcon,
  BorderStyleIcon,
  BringToFrontIcon,
  DotsIcon,
  ItalicIcon,
  NonePaddingIcon,
  PaddingIcon,
  ScaleIcon,
  SendToBackIcon,
  StrikethroughIcon,
  ThicknessIcon,
  UnderlineIcon,
} from './palette-icons';
import { ShapeIcon } from './shape-icon';
import { Tooltip } from './Tooltip';

import type { SelectedElementControls } from './CommandPalette';

export type SelectedAccordionState = {
  shape: boolean;
  table: boolean;
  layer: boolean;
  text: boolean;
  colours: boolean;
  border: boolean;
  line: boolean;
  pointer: boolean;
};

// All-closed snapshot used by the three sites that reset / initialise
// the accordion state: the ContextPanel's useState initial value, its
// `closeAll` reducer, and SelectedElementSection's `toggle` reducer.
// Listing every key in three places was a footgun, the most recent
// accordion to land (`line`, in the Line / Pointer split) needed
// three matching edits and any future addition would too.
//
// `as const satisfies` keeps the literal narrowed AND lets the
// satisfies check fail at compile time if a new key shows up on
// SelectedAccordionState without being added here.
export const ALL_SELECTED_ACCORDIONS_CLOSED = {
  shape: false,
  table: false,
  layer: false,
  text: false,
  colours: false,
  border: false,
  line: false,
  pointer: false,
} as const satisfies SelectedAccordionState;

export function SelectedElementSection({
  selection,
  open,
  setOpen,
}: {
  selection: SelectedElementControls;
  open: SelectedAccordionState;
  setOpen: React.Dispatch<React.SetStateAction<SelectedAccordionState>>;
}) {
  // Mutually exclusive: opening an accordion closes every other one.
  // Same key being toggled flips it shut. Keeps the panel compact
  // even when several accordion-eligible sections apply.
  const toggle = (key: keyof SelectedAccordionState) =>
    setOpen((prev) => {
      if (prev[key]) return ALL_SELECTED_ACCORDIONS_CLOSED;
      return { ...ALL_SELECTED_ACCORDIONS_CLOSED, [key]: true };
    });

  // Only surface the Text accordion once the element actually has a
  // label: with no text, size / style / alignment / padding have
  // nothing to act on, so the accordion is just noise.
  const showText =
    selection.hasText && (selection.textSize !== null || selection.textAlignX !== null);
  const showColours =
    selection.textColor !== null || selection.fillColor !== null || selection.strokeColor !== null;

  return (
    <div className="flex flex-col">
      {selection.shapeKind !== null ? (
        <Accordion title="Shape" open={open.shape} onToggle={() => toggle('shape')}>
          <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Change shape</p>
          <div className="mt-1 grid grid-cols-4 gap-1">
            {(
              [
                'square',
                'circle',
                'diamond',
                'cylinder',
                'parallelogram',
                'hexagon',
                'document',
                'stadium',
                'actor',
                'cloud',
                'browser',
                'monitor',
                'laptop',
                'phone',
                'tablet',
              ] as const
            ).map((kind) => (
              <Tooltip
                key={kind}
                title={SHAPE_LABEL[kind]}
                description={`Morph the selected element into a ${SHAPE_LABEL[kind].toLowerCase()}.`}
              >
                <SizeButton
                  active={selection.shapeKind === kind}
                  onClick={() => selection.onSetShapeKind(kind)}
                >
                  <ShapeIcon kind={kind} />
                </SizeButton>
              </Tooltip>
            ))}
          </div>
          {selection.aspectLocked !== null ? (
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
              <div className="flex flex-col">
                <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
                  Lock aspect ratio
                </span>
                <span className="text-[10px] text-slate-500 dark:text-slate-400">
                  Keep width-to-height fixed when resizing.
                </span>
              </div>
              <ToggleSwitch
                checked={selection.aspectLocked}
                onChange={selection.onToggleAspectLock}
                label="Lock aspect ratio"
              />
            </div>
          ) : null}
        </Accordion>
      ) : null}

      {selection.tableHeaderRow !== null ? (
        <Accordion title="Table" open={open.table} onToggle={() => toggle('table')}>
          <div className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
                Header row
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Style the first row as a header.
              </span>
            </div>
            <ToggleSwitch
              checked={selection.tableHeaderRow ?? false}
              onChange={selection.onToggleTableHeaderRow}
              label="Header row"
            />
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 dark:border-slate-800">
            <div className="flex flex-col">
              <span className="text-[11px] font-medium text-slate-700 dark:text-slate-200">
                Header column
              </span>
              <span className="text-[10px] text-slate-500 dark:text-slate-400">
                Style the first column as a header.
              </span>
            </div>
            <ToggleSwitch
              checked={selection.tableHeaderColumn ?? false}
              onChange={selection.onToggleTableHeaderColumn}
              label="Header column"
            />
          </div>
        </Accordion>
      ) : null}

      <Accordion title="Layer" open={open.layer} onToggle={() => toggle('layer')}>
        <div className="flex items-center gap-1">
          <Tooltip title="Bring to front" description="Render this element above everything else.">
            <LabelButton onClick={selection.onBringToFront} label="Front">
              <BringToFrontIcon />
            </LabelButton>
          </Tooltip>
          <Tooltip title="Send to back" description="Render this element behind everything else.">
            <LabelButton onClick={selection.onSendToBack} label="Back">
              <SendToBackIcon />
            </LabelButton>
          </Tooltip>
        </div>
        <div className="my-2 h-px bg-slate-100 dark:bg-slate-800" />
        <p className="text-[10px] font-medium text-slate-500 dark:text-slate-300">Opacity</p>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(selection.opacity * 100)}
            onChange={(e) => selection.onSetOpacity(Number(e.target.value) / 100)}
            aria-label="Opacity"
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-500 dark:bg-slate-700"
          />
          <span className="w-10 text-right text-xs font-medium text-slate-700 dark:text-slate-200">
            {Math.round(selection.opacity * 100)}%
          </span>
        </div>
      </Accordion>

      {showText ? (
        <Accordion title="Text" open={open.text} onToggle={() => toggle('text')}>
          {selection.textSize !== null ? (
            <div className="flex flex-col gap-1">
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Size</p>
              <div className="grid grid-cols-4 gap-1">
                <Tooltip title="Scale" description="Auto-fit the label to the element's size.">
                  <SizeButton
                    active={selection.textSize === 'scale'}
                    onClick={() => selection.onSetTextSize('scale')}
                  >
                    <ScaleIcon />
                  </SizeButton>
                </Tooltip>
                <Tooltip title="Small" description="Fixed small font size.">
                  <SizeButton
                    active={selection.textSize === 'sm'}
                    onClick={() => selection.onSetTextSize('sm')}
                  >
                    <DotsIcon count={1} />
                  </SizeButton>
                </Tooltip>
                <Tooltip title="Medium" description="Fixed medium font size.">
                  <SizeButton
                    active={selection.textSize === 'md'}
                    onClick={() => selection.onSetTextSize('md')}
                  >
                    <DotsIcon count={2} />
                  </SizeButton>
                </Tooltip>
                <Tooltip title="Large" description="Fixed large font size.">
                  <SizeButton
                    active={selection.textSize === 'lg'}
                    onClick={() => selection.onSetTextSize('lg')}
                  >
                    <DotsIcon count={3} />
                  </SizeButton>
                </Tooltip>
              </div>
            </div>
          ) : null}
          {selection.textBold !== null ? (
            <div className="mt-3 flex flex-col gap-1 border-t border-slate-100 pt-3 dark:border-slate-800">
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Style</p>
              <div className="grid grid-cols-4 gap-1">
                <Tooltip block title="Bold" description="Make the label bold.">
                  <SizeButton
                    active={selection.textBold === true}
                    onClick={selection.onToggleTextBold}
                  >
                    <BoldIcon />
                  </SizeButton>
                </Tooltip>
                <Tooltip block title="Italic" description="Italicise the label.">
                  <SizeButton
                    active={selection.textItalic === true}
                    onClick={selection.onToggleTextItalic}
                  >
                    <ItalicIcon />
                  </SizeButton>
                </Tooltip>
                <Tooltip block title="Underline" description="Underline the label.">
                  <SizeButton
                    active={selection.textUnderline === true}
                    onClick={selection.onToggleTextUnderline}
                  >
                    <UnderlineIcon />
                  </SizeButton>
                </Tooltip>
                <Tooltip block title="Strikethrough" description="Strike through the label.">
                  <SizeButton
                    active={selection.textStrikethrough === true}
                    onClick={selection.onToggleTextStrikethrough}
                  >
                    <StrikethroughIcon />
                  </SizeButton>
                </Tooltip>
              </div>
            </div>
          ) : null}
          {selection.textAlignX !== null && selection.textAlignY !== null ? (
            <div className="mt-3 flex flex-col gap-1 border-t border-slate-100 pt-3 dark:border-slate-800">
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                Alignment
              </p>
              <AlignmentGrid
                alignX={selection.textAlignX}
                alignY={selection.textAlignY}
                onChange={selection.onSetTextAlign}
              />
            </div>
          ) : null}
          {selection.padding !== null ? (
            <div className="mt-3 flex flex-col gap-1 border-t border-slate-100 pt-3 dark:border-slate-800">
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Padding</p>
              <div className="grid grid-cols-4 gap-1">
                {(['none', 'sm', 'md', 'lg'] as const).map((p) => (
                  <Tooltip
                    key={p}
                    block
                    title={
                      p === 'none' ? 'None' : p === 'sm' ? 'Small' : p === 'md' ? 'Medium' : 'Large'
                    }
                    description="Padding around the label."
                  >
                    <SizeButton
                      active={selection.padding === p}
                      onClick={() => selection.onSetPadding(p)}
                    >
                      {p === 'none' ? <NonePaddingIcon /> : <PaddingIcon size={p} />}
                    </SizeButton>
                  </Tooltip>
                ))}
              </div>
            </div>
          ) : null}
        </Accordion>
      ) : null}

      {showColours ? (
        <Accordion title="Colours" open={open.colours} onToggle={() => toggle('colours')}>
          <div className="flex flex-wrap items-stretch gap-1">
            {selection.textColor !== null ? (
              <Tooltip title="Text colour" description="Set the colour of the element's label.">
                <ColorSwatch
                  label="Text"
                  value={selection.textColor}
                  onChange={selection.onSetTextColor}
                />
              </Tooltip>
            ) : null}
            {selection.fillColor !== null ? (
              <Tooltip title="Background" description="The element's fill colour.">
                <ColorSwatch
                  label="Background"
                  value={selection.fillColor}
                  onChange={selection.onSetFillColor}
                />
              </Tooltip>
            ) : null}
            {selection.strokeColor !== null ? (
              <Tooltip title="Border" description="The element's outline colour.">
                <ColorSwatch
                  label="Border"
                  value={selection.strokeColor}
                  onChange={selection.onSetStrokeColor}
                />
              </Tooltip>
            ) : null}
          </div>
          <button
            type="button"
            onClick={selection.onResetColors}
            className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15"
          >
            Reset to theme
          </button>
        </Accordion>
      ) : null}

      {/* Border accordion: visible when a shape is selected (shapes
          carry the strokeWidth / strokeStyle fields). Mirrors the
          Pointer accordion's icon-button-row pattern so shape borders
          feel like a peer of arrow pointers. The Radius row below is
          gated separately: only the free-corner rectangles (square /
          browser) expose it, so borderRadius is null for every other
          shape and the row is hidden without hiding the accordion. */}
      {selection.borderStroke !== null && selection.borderStyle !== null ? (
        <Accordion title="Border" open={open.border} onToggle={() => toggle('border')}>
          <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Strength</p>
          <div className="mt-1 grid grid-cols-5 gap-1">
            {(['none', 'thin', 'medium', 'thick', 'extra-thick'] as const).map((value) => (
              <Tooltip
                key={value}
                block
                title={BORDER_STROKE_LABEL[value]}
                description={`Border thickness: ${BORDER_STROKE_LABEL[value].toLowerCase()}.`}
              >
                <SizeButton
                  active={selection.borderStroke === value}
                  onClick={() => selection.onSetBorderStroke(value)}
                >
                  <BorderStrokeIcon value={value} />
                </SizeButton>
              </Tooltip>
            ))}
          </div>
          <p className="mt-3 text-[10px] font-medium text-slate-500 dark:text-slate-300">Pattern</p>
          <div className="mt-1 grid grid-cols-3 gap-1">
            {(['solid', 'dashed', 'dotted'] as const).map((value) => (
              <Tooltip
                key={value}
                block
                title={BORDER_STYLE_LABEL[value]}
                description={`Border pattern: ${BORDER_STYLE_LABEL[value].toLowerCase()}.`}
              >
                <SizeButton
                  active={selection.borderStyle === value}
                  onClick={() => selection.onSetBorderStyle(value)}
                >
                  <BorderStyleIcon value={value} />
                </SizeButton>
              </Tooltip>
            ))}
          </div>
          {selection.borderRadius !== null ? (
            <>
              <p className="mt-3 text-[10px] font-medium text-slate-500 dark:text-slate-300">
                Radius
              </p>
              <div className="mt-1 grid grid-cols-4 gap-1">
                {(['none', 'sm', 'md', 'lg'] as const).map((value) => (
                  <Tooltip
                    key={value}
                    block
                    title={BORDER_RADIUS_LABEL[value]}
                    description={`Corner radius: ${BORDER_RADIUS_LABEL[value].toLowerCase()}.`}
                  >
                    <SizeButton
                      active={selection.borderRadius === value}
                      onClick={() => selection.onSetBorderRadius(value)}
                    >
                      <BorderRadiusIcon value={value} />
                    </SizeButton>
                  </Tooltip>
                ))}
              </div>
            </>
          ) : null}
        </Accordion>
      ) : null}

      {selection.arrowEnds !== null &&
      (selection.arrowThickness !== null ||
        selection.arrowStyle !== null ||
        selection.arrowStrokeStyle !== null) ? (
        <Accordion title="Line" open={open.line} onToggle={() => toggle('line')}>
          {selection.arrowThickness !== null ? (
            <>
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                Thickness
              </p>
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
                    <SizeButton
                      active={selection.arrowThickness === id}
                      onClick={() => selection.onSetArrowThickness(id)}
                    >
                      <ThicknessIcon px={ARROW_THICKNESS_PX[id]} />
                    </SizeButton>
                  </Tooltip>
                ))}
              </div>
              <div className="my-2 h-px bg-slate-100 dark:bg-slate-800" />
            </>
          ) : null}
          {selection.arrowStyle !== null ? (
            <>
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                Line style
              </p>
              <div className="mt-1 grid grid-cols-3 gap-1">
                {(
                  [
                    ['straight', 'Straight', 'Plain straight line, the default.'],
                    [
                      'curved',
                      'Curved',
                      'Smooth bezier curve bowing perpendicular to the endpoints.',
                    ],
                    [
                      'angled',
                      'Angled',
                      'Axis-aligned L-connector with a single right-angle bend.',
                    ],
                  ] as [ArrowStyle, string, string][]
                ).map(([id, label, desc]) => (
                  <Tooltip key={id} title={label} description={desc}>
                    <SizeButton
                      active={selection.arrowStyle === id}
                      onClick={() => selection.onSetArrowStyle(id)}
                    >
                      <ArrowStyleIcon style={id} />
                    </SizeButton>
                  </Tooltip>
                ))}
              </div>
              <div className="my-2 h-px bg-slate-100 dark:bg-slate-800" />
            </>
          ) : null}
          {selection.arrowStrokeStyle !== null ? (
            <>
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                Line pattern
              </p>
              <div className="mt-1 grid grid-cols-3 gap-1">
                {(['solid', 'dashed', 'dotted'] as const).map((value) => (
                  <Tooltip
                    key={value}
                    block
                    title={BORDER_STYLE_LABEL[value]}
                    description={`Line pattern: ${BORDER_STYLE_LABEL[value].toLowerCase()}.`}
                  >
                    <SizeButton
                      active={selection.arrowStrokeStyle === value}
                      onClick={() => selection.onSetArrowStrokeStyle(value)}
                    >
                      <BorderStyleIcon value={value} />
                    </SizeButton>
                  </Tooltip>
                ))}
              </div>
            </>
          ) : null}
        </Accordion>
      ) : null}

      {selection.arrowEnds !== null ? (
        <Accordion title="Pointer" open={open.pointer} onToggle={() => toggle('pointer')}>
          <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
            Pick which end(s) of the arrow have a pointer.
          </p>
          <div className="mt-1 grid grid-cols-4 gap-1">
            <Tooltip title="Start only" description="Arrowhead on the left / starting end only.">
              <SizeButton
                active={selection.arrowEnds === 'from'}
                onClick={() => selection.onSetArrowEnds('from')}
              >
                <ArrowEndsIcon ends="from" />
              </SizeButton>
            </Tooltip>
            <Tooltip
              title="End only"
              description="Arrowhead on the right / ending end only (the default)."
            >
              <SizeButton
                active={selection.arrowEnds === 'to'}
                onClick={() => selection.onSetArrowEnds('to')}
              >
                <ArrowEndsIcon ends="to" />
              </SizeButton>
            </Tooltip>
            <Tooltip title="Both ends" description="Arrowheads on both ends (a two-way connector).">
              <SizeButton
                active={selection.arrowEnds === 'both'}
                onClick={() => selection.onSetArrowEnds('both')}
              >
                <ArrowEndsIcon ends="both" />
              </SizeButton>
            </Tooltip>
            <Tooltip
              title="No pointers"
              description="No arrowhead on either end — a plain connector / line."
            >
              <SizeButton
                active={selection.arrowEnds === 'none'}
                onClick={() => selection.onSetArrowEnds('none')}
              >
                <ArrowEndsIcon ends="none" />
              </SizeButton>
            </Tooltip>
          </div>
          {selection.arrowheadSize !== null && selection.arrowEnds !== 'none' ? (
            <>
              <div className="my-2 h-px bg-slate-100 dark:bg-slate-800" />
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                Arrowhead size
              </p>
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
                    description={`Marker size ${ARROWHEAD_SIZE_PX[id]} — independent of line thickness.`}
                  >
                    <SizeButton
                      active={selection.arrowheadSize === id}
                      onClick={() => selection.onSetArrowheadSize(id)}
                    >
                      <ArrowheadSizeIcon px={ARROWHEAD_SIZE_PX[id]} />
                    </SizeButton>
                  </Tooltip>
                ))}
              </div>
            </>
          ) : null}
          {selection.arrowheadShape !== null && selection.arrowEnds !== 'none' ? (
            <>
              <div className="my-2 h-px bg-slate-100 dark:bg-slate-800" />
              <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
                Arrowhead shape
              </p>
              <div className="mt-1 grid grid-cols-4 gap-1">
                {ARROWHEAD_SHAPES.map((shape) => (
                  <Tooltip
                    key={shape}
                    title={ARROWHEAD_SHAPE_LABEL[shape]}
                    description={ARROWHEAD_SHAPE_DESC[shape]}
                  >
                    <SizeButton
                      active={selection.arrowheadShape === shape}
                      onClick={() => selection.onSetArrowheadShape(shape)}
                    >
                      <ArrowheadShapeIcon shape={shape} />
                    </SizeButton>
                  </Tooltip>
                ))}
              </div>
            </>
          ) : null}
        </Accordion>
      ) : null}
    </div>
  );
}

const ARROWHEAD_SHAPE_LABEL: Record<ArrowheadShape, string> = {
  triangle: 'Filled triangle',
  'triangle-hollow': 'Hollow triangle',
  line: 'Open',
  circle: 'Dot',
  'circle-hollow': 'Hollow dot',
  diamond: 'Filled diamond',
  'diamond-hollow': 'Hollow diamond',
};

// Tooltips lean on the conventional UML / flowchart meanings so the
// picker doubles as a hint for what each head is used for.
const ARROWHEAD_SHAPE_DESC: Record<ArrowheadShape, string> = {
  triangle: 'The classic filled arrowhead.',
  'triangle-hollow': 'A hollow triangle — UML inheritance / "is a".',
  line: 'An open V with no fill — dependency / flow.',
  circle: 'A filled dot terminator.',
  'circle-hollow': 'A hollow dot terminator.',
  diamond: 'A filled diamond — UML composition.',
  'diamond-hollow': 'A hollow diamond — UML aggregation.',
};

const SHAPE_LABEL: Record<ShapeKind, string> = {
  square: 'Square',
  circle: 'Circle',
  diamond: 'Diamond',
  cylinder: 'Cylinder',
  parallelogram: 'Parallelogram',
  hexagon: 'Hexagon',
  document: 'Document',
  stadium: 'Stadium',
  actor: 'User',
  cloud: 'Cloud',
  browser: 'Web browser',
  monitor: 'Computer monitor',
  laptop: 'Laptop',
  phone: 'Phone',
  tablet: 'Tablet',
  // Not offered in the morph grid (an icon needs a chosen glyph, added
  // via the Icons picker); present here only so the label map stays
  // exhaustive over ShapeKind.
  icon: 'Icon',
};

// Border-accordion labels + glyphs. Three rows: stroke strength,
// stroke pattern, corner radius. Each glyph renders a horizontal
// line / squiggle whose visual weight or pattern hints at the preset
// the button maps to, matching the Pointer accordion's row
// conventions so the two reads as siblings.

const BORDER_STROKE_LABEL: Record<BorderStroke, string> = {
  none: 'None',
  thin: 'Thin',
  medium: 'Medium',
  thick: 'Thick',
  'extra-thick': 'Extra-thick',
};

const BORDER_STYLE_LABEL: Record<BorderStyle, string> = {
  solid: 'Solid',
  dashed: 'Dashed',
  dotted: 'Dotted',
};

const BORDER_RADIUS_LABEL: Record<BorderRadius, string> = {
  none: 'None',
  sm: 'Small',
  md: 'Medium',
  lg: 'Large',
};
