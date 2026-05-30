import { useState } from 'react';
import type {
  ArrowEnds,
  ArrowThickness,
  BackgroundPattern,
  Padding,
  ShapeKind,
  TextAlignX,
  TextAlignY,
  TextSize,
} from '@livediagram/diagram';
import { ARROW_THICKNESS_PX } from '@livediagram/diagram';
import { THEMES, type ThemeId } from '@/lib/themes';
import { MovablePanel } from './MovablePanel';
import { Tooltip } from './Tooltip';

export type SelectedElementControls = {
  textSize: TextSize | null;
  textAlignX: TextAlignX | null;
  textAlignY: TextAlignY | null;
  textColor: string | null;
  fillColor: string | null;
  strokeColor: string | null;
  opacity: number;
  onBringToFront: () => void;
  onSendToBack: () => void;
  onSetTextSize: (size: TextSize) => void;
  onSetTextAlign: (x: TextAlignX, y: TextAlignY) => void;
  onSetTextColor: (color: string) => void;
  onSetFillColor: (color: string) => void;
  onSetStrokeColor: (color: string) => void;
  onSetOpacity: (opacity: number) => void;
  onResetColors: () => void;
  padding: Padding | null;
  onSetPadding: (padding: Padding) => void;
  // Inline label styling. `null` for elements without a label (e.g.
  // arrows). The Text accordion renders a row of toggle buttons that
  // flip these booleans independently — any combination works.
  textBold: boolean | null;
  textItalic: boolean | null;
  textUnderline: boolean | null;
  textStrikethrough: boolean | null;
  onToggleTextBold: () => void;
  onToggleTextItalic: () => void;
  onToggleTextUnderline: () => void;
  onToggleTextStrikethrough: () => void;
  // Non-null only when an arrow is selected. Drives the Pointer
  // accordion that lets the user choose which end(s) of the arrow
  // get an arrowhead.
  arrowEnds: ArrowEnds | null;
  onSetArrowEnds: (ends: ArrowEnds) => void;
  // Same gate as arrowEnds: drives the thickness row inside the
  // Pointer accordion. Snapped to the nearest preset for display so
  // arrows authored before the field existed still highlight one.
  arrowThickness: ArrowThickness | null;
  onSetArrowThickness: (thickness: ArrowThickness) => void;
  // Non-null only when a shape element is selected. Drives the Shape
  // accordion's morph-into-this-kind grid.
  shapeKind: ShapeKind | null;
  onSetShapeKind: (kind: ShapeKind) => void;
  // Whether the selected boxed element's width/height ratio is
  // locked during resize. `null` when the selection is something
  // that doesn't support aspect-lock (e.g. arrows).
  aspectLocked: boolean | null;
  onToggleAspectLock: () => void;
};

export type TabSectionControls = {
  backgroundPattern: BackgroundPattern;
  backgroundColor: string;
  patternColor: string;
  themeId: ThemeId;
  onSetBackgroundPattern: (pattern: BackgroundPattern) => void;
  onSetBackgroundColor: (color: string) => void;
  backgroundOpacity: number;
  onSetBackgroundOpacity: (opacity: number) => void;
  onSetPatternColor: (color: string) => void;
  onSetTheme: (id: ThemeId) => void;
};

export type CanvasTool = 'pan' | 'select';

type CommandPaletteProps = {
  position: { x: number; y: number } | null;
  minimized: boolean;
  size: { width: number; height: number } | null;
  canvasTool: CanvasTool;
  onSetCanvasTool: (tool: CanvasTool) => void;
  onMoveTo: (x: number, y: number) => void;
  onToggleMinimized: () => void;
  onResize: (size: { width: number; height: number }) => void;
  onReset: () => void;
  onAddShape: (kind: ShapeKind) => void;
  onAddText: () => void;
  onAddSticky: () => void;
  // Drops a horizontal arrow at the viewport centre with no pointers
  // on either end by default (i.e. a plain line). Users can flip the
  // arrowEnds afterwards via the Pointer accordion.
  onAddArrow: () => void;
};

export function CommandPalette(props: CommandPaletteProps) {
  // Minimised state is rendered by Canvas's bottom dock — see DockButton.
  if (props.minimized) return null;
  return <OpenPalette {...props} />;
}

function OpenPalette({
  position,
  size,
  canvasTool,
  onSetCanvasTool,
  onMoveTo,
  onToggleMinimized,
  onResize,
  onReset,
  onAddShape,
  onAddText,
  onAddSticky,
  onAddArrow,
}: CommandPaletteProps) {
  // The Selected Element / Current Tab sections moved out into the
  // ContextPanel (bottom-right, above zoom). The palette now hosts
  // only the canvas-tool toggle and the shape primitives.
  return (
    <MovablePanel
      title="Palette"
      position={position}
      defaultCorner="top-right"
      width="w-64"
      size={size}
      // Now that the Selected Element / Current Tab sections moved
      // into the Editor panel, the Palette only hosts the canvas-
      // tool toggle and the shape primitives. Mins shrink to match
      // (200 wide keeps the 4-column shape grid tidy; 180 high fits
      // the tool row, both shape rows, and the text/sticky/arrow
      // row with breathing room).
      minWidth={200}
      minHeight={180}
      onResize={onResize}
      onReset={onReset}
      onMoveTo={onMoveTo}
      onMinimize={onToggleMinimized}
    >
      <div className="px-2 pb-2">
        {/* Canvas tool toggle. Pan is the default — drag-on-empty
            scrolls the canvas. Switching to Select makes drag-on-empty
            draw a marquee for multi-select. Holding Space pans
            regardless of the active tool, mirroring Figma. */}
        <div className="flex items-center gap-1 pb-1.5">
          <Tooltip
            title="Pan"
            description="Drag the empty canvas to scroll. Hold Space to pan even when Select is active."
          >
            <ToolButton
              active={canvasTool === 'pan'}
              label="Pan"
              onClick={() => onSetCanvasTool('pan')}
            >
              <PanIcon />
            </ToolButton>
          </Tooltip>
          <Tooltip
            title="Select"
            description="Drag the empty canvas to marquee-select multiple elements."
          >
            <ToolButton
              active={canvasTool === 'select'}
              label="Select"
              onClick={() => onSetCanvasTool('select')}
            >
              <SelectIcon />
            </ToolButton>
          </Tooltip>
        </div>
        <div className="mb-1.5 h-px bg-slate-100" />
        {/* Shape primitives. Wraps to a second row once the palette runs
            out of horizontal room. Ordered by frequency / familiarity:
            primitive geometry first, then flowchart-vocabulary shapes. */}
        <div className="flex flex-wrap items-center gap-1">
          <IconButton
            label="Add square"
            description="Drop a new square shape on the canvas."
            onClick={() => onAddShape('square')}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <rect
                x="3"
                y="3"
                width="12"
                height="12"
                rx="2"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              />
            </svg>
          </IconButton>
          <IconButton
            label="Add circle"
            description="Drop a new circle shape on the canvas."
            onClick={() => onAddShape('circle')}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </IconButton>
          <IconButton
            label="Add diamond"
            description="Drop a diamond shape (decision node, UML-style)."
            onClick={() => onAddShape('diamond')}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <polygon
                points="9,2.5 15.5,9 9,15.5 2.5,9"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </IconButton>
          <IconButton
            label="Add cylinder"
            description="Drop a cylinder (database / storage in flowcharts)."
            onClick={() => onAddShape('cylinder')}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <path
                d="M3 5 L3 13 A6 1.8 0 0 0 15 13 L15 5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
              <ellipse
                cx="9"
                cy="5"
                rx="6"
                ry="1.8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              />
            </svg>
          </IconButton>
          <IconButton
            label="Add parallelogram"
            description="Drop a parallelogram (input/output in flowcharts)."
            onClick={() => onAddShape('parallelogram')}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <polygon
                points="5,3 16,3 13,15 2,15"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </IconButton>
          <IconButton
            label="Add hexagon"
            description="Drop a hexagon (preparation / labelled milestone)."
            onClick={() => onAddShape('hexagon')}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <polygon
                points="5,3 13,3 16,9 13,15 5,15 2,9"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinejoin="round"
              />
            </svg>
          </IconButton>
          <IconButton
            label="Add document"
            description="Drop a document shape (output document in flowcharts)."
            onClick={() => onAddShape('document')}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <path
                d="M3 3 L15 3 L15 13 C13 15.3 11 11.8 9 13.5 C7 15.3 5 11.8 3 13.5 Z"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </svg>
          </IconButton>
          <IconButton
            label="Add stadium"
            description="Drop a stadium / pill shape (Start / End in flowcharts)."
            onClick={() => onAddShape('stadium')}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <rect
                x="1.5"
                y="6"
                width="15"
                height="6"
                rx="3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
              />
            </svg>
          </IconButton>
        </div>
        <div className="my-1 h-px bg-slate-100" />
        <div className="flex items-center gap-1">
          <IconButton
            label="Add text"
            description="Drop a draggable text element you can edit by double-clicking."
            onClick={onAddText}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <path
                d="M3 5h12M9 5v9M6.5 14h5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </IconButton>
          <IconButton
            label="Add arrow"
            description="Drop a plain connector at the viewport centre. Defaults to no pointers — toggle pointers from the Pointer accordion once it's selected."
            onClick={onAddArrow}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <line
                x1="3"
                y1="9"
                x2="15"
                y2="9"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </IconButton>
          <IconButton
            label="Add sticky note"
            description="Drop a yellow sticky note for short multi-line annotations."
            onClick={onAddSticky}
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <path
                d="M3 3h9l3 3v9H3z"
                fill="rgb(254 243 199)"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M12 3v3h3"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </IconButton>
        </div>
      </div>
    </MovablePanel>
  );
}

export type SelectedAccordionState = {
  shape: boolean;
  appearance: boolean;
  layer: boolean;
  text: boolean;
  colours: boolean;
  pointer: boolean;
};

export function SelectedElementSection({
  selection,
  open,
  setOpen,
}: {
  selection: SelectedElementControls;
  open: SelectedAccordionState;
  setOpen: React.Dispatch<React.SetStateAction<SelectedAccordionState>>;
}) {
  const toggle = (key: keyof SelectedAccordionState) =>
    setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  const showText = selection.textSize !== null || selection.textAlignX !== null;
  const showColours =
    selection.textColor !== null || selection.fillColor !== null || selection.strokeColor !== null;

  return (
    <div className="flex flex-col border-t border-slate-200">
      <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Selected Element
      </p>

      {selection.shapeKind !== null ? (
        <Accordion title="Shape" open={open.shape} onToggle={() => toggle('shape')}>
          <p className="text-[10px] font-medium text-slate-500">Change shape</p>
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
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
              <div className="flex flex-col">
                <span className="text-[11px] font-medium text-slate-700">Lock aspect ratio</span>
                <span className="text-[10px] text-slate-500">
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

      <Accordion title="Appearance" open={open.appearance} onToggle={() => toggle('appearance')}>
        <p className="text-[10px] font-medium text-slate-500">Opacity</p>
        <div className="mt-1 flex items-center gap-2">
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(selection.opacity * 100)}
            onChange={(e) => selection.onSetOpacity(Number(e.target.value) / 100)}
            aria-label="Opacity"
            className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-500"
          />
          <span className="w-10 text-right text-xs font-medium text-slate-700">
            {Math.round(selection.opacity * 100)}%
          </span>
        </div>
      </Accordion>

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
      </Accordion>

      {showText ? (
        <Accordion title="Text" open={open.text} onToggle={() => toggle('text')}>
          {selection.textSize !== null ? (
            <div className="flex flex-col gap-1">
              <p className="text-[10px] font-medium text-slate-500">Size</p>
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
            <div className="mt-3 flex flex-col gap-1 border-t border-slate-100 pt-3">
              <p className="text-[10px] font-medium text-slate-500">Style</p>
              <div className="grid grid-cols-4 gap-1">
                <Tooltip title="Bold" description="Make the label bold.">
                  <SizeButton
                    active={selection.textBold === true}
                    onClick={selection.onToggleTextBold}
                  >
                    <BoldIcon />
                  </SizeButton>
                </Tooltip>
                <Tooltip title="Italic" description="Italicise the label.">
                  <SizeButton
                    active={selection.textItalic === true}
                    onClick={selection.onToggleTextItalic}
                  >
                    <ItalicIcon />
                  </SizeButton>
                </Tooltip>
                <Tooltip title="Underline" description="Underline the label.">
                  <SizeButton
                    active={selection.textUnderline === true}
                    onClick={selection.onToggleTextUnderline}
                  >
                    <UnderlineIcon />
                  </SizeButton>
                </Tooltip>
                <Tooltip title="Strikethrough" description="Strike through the label.">
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
            <div className="mt-3 flex flex-col gap-1 border-t border-slate-100 pt-3">
              <p className="text-[10px] font-medium text-slate-500">Alignment</p>
              <AlignmentGrid
                alignX={selection.textAlignX}
                alignY={selection.textAlignY}
                onChange={selection.onSetTextAlign}
              />
            </div>
          ) : null}
          {selection.padding !== null ? (
            <div className="mt-3 flex flex-col gap-1 border-t border-slate-100 pt-3">
              <p className="text-[10px] font-medium text-slate-500">Padding</p>
              <div className="grid grid-cols-4 gap-1">
                {(['none', 'sm', 'md', 'lg'] as const).map((p) => (
                  <Tooltip
                    key={p}
                    title={
                      p === 'none' ? 'None' : p === 'sm' ? 'Small' : p === 'md' ? 'Medium' : 'Large'
                    }
                    description="Space between the element's border and its label."
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
            className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50"
          >
            Reset to theme
          </button>
        </Accordion>
      ) : null}

      {selection.arrowEnds !== null ? (
        <Accordion title="Pointer" open={open.pointer} onToggle={() => toggle('pointer')}>
          {selection.arrowThickness !== null ? (
            <>
              <p className="text-[10px] font-medium text-slate-500">Thickness</p>
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
              <div className="my-2 h-px bg-slate-100" />
            </>
          ) : null}
          <p className="text-[10px] font-medium text-slate-500">
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
        </Accordion>
      ) : null}
    </div>
  );
}

const SHAPE_LABEL: Record<ShapeKind, string> = {
  square: 'Square',
  circle: 'Circle',
  diamond: 'Diamond',
  cylinder: 'Cylinder',
  parallelogram: 'Parallelogram',
  hexagon: 'Hexagon',
  document: 'Document',
  stadium: 'Stadium',
};

function ShapeIcon({ kind }: { kind: ShapeKind }) {
  // Mini glyphs that mirror what the palette uses for the Add buttons,
  // scaled to fit a 14×14 tile. Pure outlines so the active-state
  // background (from SizeButton) reads through.
  switch (kind) {
    case 'square':
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <rect x="3" y="3" width="10" height="10" rx="1.5" />
        </svg>
      );
    case 'circle':
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <circle cx="8" cy="8" r="5" />
        </svg>
      );
    case 'diamond':
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          aria-hidden
        >
          <polygon points="8,3 13,8 8,13 3,8" />
        </svg>
      );
    case 'cylinder':
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M3 5 L3 12 A5 1.5 0 0 0 13 12 L13 5" />
          <ellipse cx="8" cy="5" rx="5" ry="1.5" />
        </svg>
      );
    case 'parallelogram':
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          aria-hidden
        >
          <polygon points="4,3 13,3 12,13 3,13" />
        </svg>
      );
    case 'hexagon':
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          aria-hidden
        >
          <polygon points="5,3 11,3 14,8 11,13 5,13 2,8" />
        </svg>
      );
    case 'document':
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M3 3 L13 3 L13 12 C11 13.4 9.5 11.5 8 12.6 C6.5 13.7 5 11.5 3 12.6 Z" />
        </svg>
      );
    case 'stadium':
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <rect x="2" y="5" width="12" height="6" rx="3" />
        </svg>
      );
  }
}

// iOS-style toggle switch. Used by the Shape accordion's Lock-aspect
// row but generic enough for any future boolean preference that
// belongs alongside its label rather than as an icon button.
function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={
        checked
          ? 'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-brand-500 transition'
          : 'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-slate-300 transition'
      }
    >
      <span
        aria-hidden
        className={
          checked
            ? 'inline-block h-3.5 w-3.5 translate-x-[18px] rounded-full bg-white shadow-sm transition'
            : 'inline-block h-3.5 w-3.5 translate-x-[3px] rounded-full bg-white shadow-sm transition'
        }
      />
    </button>
  );
}

function BoldIcon() {
  return <span className="text-[13px] font-bold leading-none text-slate-700">B</span>;
}

function ItalicIcon() {
  return <span className="text-[13px] font-semibold italic leading-none text-slate-700">I</span>;
}

function UnderlineIcon() {
  return (
    <span
      className="text-[13px] font-semibold leading-none text-slate-700"
      style={{ textDecoration: 'underline' }}
    >
      U
    </span>
  );
}

function StrikethroughIcon() {
  return (
    <span
      className="text-[13px] font-semibold leading-none text-slate-700"
      style={{ textDecoration: 'line-through' }}
    >
      S
    </span>
  );
}

// Renders a short horizontal line at the given stroke-width inside the
// SizeButton frame so the user can pick a thickness preset visually
// rather than by name.
function ThicknessIcon({ px }: { px: number }) {
  return (
    <svg width="22" height="14" viewBox="0 0 22 14" fill="none" aria-hidden>
      <line
        x1="3"
        y1="7"
        x2="19"
        y2="7"
        stroke="currentColor"
        strokeWidth={px}
        strokeLinecap="round"
      />
    </svg>
  );
}

function ArrowEndsIcon({ ends }: { ends: ArrowEnds }) {
  // Same shape language as the arrowhead used in ArrowView, scaled
  // down to fit a 14×14 button. Line spans the middle; chevrons sit
  // on the appropriate end(s). 'none' renders a plain line — a
  // connector with no pointer at either end.
  const showStart = ends === 'from' || ends === 'both';
  const showEnd = ends === 'to' || ends === 'both';
  return (
    <svg
      width="16"
      height="14"
      viewBox="0 0 20 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1={showStart ? 4 : 2} y1="6" x2={showEnd ? 16 : 18} y2="6" />
      {showStart ? <path d="M2 6 L5 3 M2 6 L5 9" /> : null}
      {showEnd ? <path d="M18 6 L15 3 M18 6 L15 9" /> : null}
    </svg>
  );
}

export function TabSection({ tab }: { tab: TabSectionControls }) {
  const [open, setOpen] = useState<{ theme: boolean; background: boolean }>({
    theme: false,
    background: false,
  });
  const toggle = (key: keyof typeof open) => setOpen((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="flex flex-col border-t border-slate-200">
      <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        Current Tab
      </p>
      <Accordion title="Theme" open={open.theme} onToggle={() => toggle('theme')}>
        <p className="text-[10px] font-medium text-slate-500">
          Sets the canvas backdrop and recolours every element on this tab to match the theme
          (sticky notes keep their amber palette).
        </p>
        <div className="mt-1 grid grid-cols-3 gap-1">
          {THEMES.map((t) => {
            const active = tab.themeId === t.id;
            // Border / dot colours come from the theme's element-stroke (or
            // pattern colour when the theme is the brand default).
            const dot = t.elementStroke ?? t.patternColor;
            const swatch = t.elementFill ?? '#ffffff';
            return (
              <Tooltip
                key={t.id}
                title={t.label}
                description="Applies the theme's background and new-element colours."
                block
              >
                <button
                  type="button"
                  onClick={() => tab.onSetTheme(t.id)}
                  aria-pressed={active}
                  className={
                    active
                      ? 'flex w-full flex-col items-center gap-1 rounded-md border border-brand-400 bg-brand-50 p-1.5 text-[10px] font-medium text-brand-800'
                      : 'flex w-full flex-col items-center gap-1 rounded-md border border-slate-200 bg-white p-1.5 text-[10px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/40'
                  }
                >
                  <span
                    aria-hidden
                    style={{ backgroundColor: t.backgroundColor }}
                    className="flex h-7 w-full items-center justify-center rounded-sm border border-slate-200"
                  >
                    <span
                      style={{ backgroundColor: swatch, borderColor: dot }}
                      className="h-3 w-3 rounded-sm border"
                    />
                  </span>
                  <span>{t.label}</span>
                </button>
              </Tooltip>
            );
          })}
        </div>
      </Accordion>
      <Accordion title="Background" open={open.background} onToggle={() => toggle('background')}>
        <p className="text-[10px] font-medium text-slate-500">Pattern</p>
        <div className="mt-1 grid grid-cols-3 gap-1">
          <Tooltip title="Grid" description="Subtle dot grid background.">
            <PatternButton
              active={tab.backgroundPattern === 'grid'}
              onClick={() => tab.onSetBackgroundPattern('grid')}
              label="Grid"
            >
              <BackgroundGridIcon />
            </PatternButton>
          </Tooltip>
          <Tooltip title="Blank" description="No background pattern.">
            <PatternButton
              active={tab.backgroundPattern === 'blank'}
              onClick={() => tab.onSetBackgroundPattern('blank')}
              label="Blank"
            >
              <BackgroundBlankIcon />
            </PatternButton>
          </Tooltip>
          <Tooltip title="Lines" description="Horizontal ruled lines.">
            <PatternButton
              active={tab.backgroundPattern === 'lines'}
              onClick={() => tab.onSetBackgroundPattern('lines')}
              label="Lines"
            >
              <BackgroundLinesIcon />
            </PatternButton>
          </Tooltip>
          <Tooltip title="Graph" description="Square graph paper.">
            <PatternButton
              active={tab.backgroundPattern === 'graph'}
              onClick={() => tab.onSetBackgroundPattern('graph')}
              label="Graph"
            >
              <BackgroundGraphIcon />
            </PatternButton>
          </Tooltip>
          <Tooltip title="Crosshatch" description="Diagonal crosshatch pattern.">
            <PatternButton
              active={tab.backgroundPattern === 'crosshatch'}
              onClick={() => tab.onSetBackgroundPattern('crosshatch')}
              label="Cross"
            >
              <BackgroundCrosshatchIcon />
            </PatternButton>
          </Tooltip>
          <Tooltip title="Confetti" description="Multi-colour dots — pattern colour ignored.">
            <PatternButton
              active={tab.backgroundPattern === 'confetti'}
              onClick={() => tab.onSetBackgroundPattern('confetti')}
              label="Confetti"
            >
              <BackgroundConfettiIcon />
            </PatternButton>
          </Tooltip>
        </div>
        <p className="mt-3 border-t border-slate-100 pt-3 text-[10px] font-medium text-slate-500">
          Colours
        </p>
        <div className="mt-1 flex items-stretch gap-1">
          <Tooltip title="Canvas colour" description="The colour of the canvas background.">
            <ColorSwatch
              label="Canvas"
              value={tab.backgroundColor}
              onChange={tab.onSetBackgroundColor}
            />
          </Tooltip>
          <Tooltip title="Pattern colour" description="The colour of the grid dots or ruled lines.">
            <ColorSwatch
              label="Pattern"
              value={tab.patternColor}
              onChange={tab.onSetPatternColor}
            />
          </Tooltip>
        </div>
        <div className="mt-3 flex flex-col gap-1 border-t border-slate-100 pt-3">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-medium text-slate-500">Opacity</p>
            <span className="text-[10px] font-medium text-slate-500">
              {Math.round(tab.backgroundOpacity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={tab.backgroundOpacity}
            onChange={(e) => tab.onSetBackgroundOpacity(parseFloat(e.target.value))}
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-500"
          />
        </div>
      </Accordion>
    </div>
  );
}

function Accordion({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-slate-100 first:border-t-0">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
      >
        <span>{title}</span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          aria-hidden
          className="transition-transform duration-200 ease-out"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          <path
            d="M2 4l3 3 3-3"
            stroke="currentColor"
            strokeWidth="1.5"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: open ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-3 pb-3">{children}</div>
        </div>
      </div>
    </div>
  );
}

function LabelButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100"
    >
      <span className="text-slate-500">{children}</span>
      {label}
    </button>
  );
}

function ToolButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const base =
    'flex flex-1 items-center justify-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition';
  const tone = active
    ? 'bg-brand-500 text-white shadow-sm'
    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900';
  return (
    <button type="button" onClick={onClick} className={`${base} ${tone}`} aria-pressed={active}>
      {children}
      <span>{label}</span>
    </button>
  );
}

function PanIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 14V7" />
      <path d="M5 11V5a1.25 1.25 0 0 1 2.5 0v3" />
      <path d="M7.5 8V4a1.25 1.25 0 0 1 2.5 0v4" />
      <path d="M10 8V5a1.25 1.25 0 0 1 2.5 0v6a3.5 3.5 0 0 1-3.5 3.5H7" />
      <path d="M5 11l-1-1.5" />
    </svg>
  );
}

function SelectIcon() {
  return (
    <svg
      width="13"
      height="13"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      strokeLinecap="round"
      aria-hidden
    >
      <rect x="2" y="2" width="9" height="9" strokeDasharray="2 1.5" />
      <path d="M11 11l3 3" />
      <path d="M11 11l-1.5 -0.5l-0.5 -1.5" />
    </svg>
  );
}

function NonePaddingIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden
    >
      <rect x="2" y="2" width="12" height="12" rx="1.5" />
      <path d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

function PaddingIcon({ size }: { size: 'sm' | 'md' | 'lg' }) {
  // Outer box stays at 14x14; the inner box shrinks to visualise the
  // padding amount. Mirrors the scale in PADDING_PX.
  const inset = size === 'sm' ? 2.5 : size === 'md' ? 4 : 5.5;
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="2" width="12" height="12" rx="1.5" strokeDasharray="1.5 1.5" />
      <rect x={2 + inset} y={2 + inset} width={12 - 2 * inset} height={12 - 2 * inset} rx="1" />
    </svg>
  );
}

function ScaleIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 8h10" />
      <path d="M3 8l2 -2M3 8l2 2" />
      <path d="M13 8l-2 -2M13 8l-2 2" />
    </svg>
  );
}

function DotsIcon({ count }: { count: 1 | 2 | 3 }) {
  // Concentric size cue: 1 small dot, 2 mid dots, 3 larger dots. Each
  // dot's radius scales with `count` so the visual weight reads as
  // "size" at a glance.
  const radii = count === 1 ? [1.4] : count === 2 ? [1.8, 1.8] : [2.2, 2.2, 2.2];
  const spacing = count === 1 ? [8] : count === 2 ? [5, 11] : [3.5, 8, 12.5];
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
      {radii.map((r, i) => (
        <circle key={i} cx={spacing[i]} cy={8} r={r} />
      ))}
    </svg>
  );
}

function SizeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const base = 'rounded-md px-1.5 py-1 text-xs font-medium transition';
  const styled = active
    ? 'bg-brand-100 text-brand-700'
    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900';
  return (
    <button type="button" onClick={onClick} className={`${base} ${styled}`}>
      {children}
    </button>
  );
}

function PatternButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const base = 'flex flex-col items-center gap-1 rounded-md p-2 transition';
  const styled = active
    ? 'bg-brand-100 text-brand-700'
    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900';
  return (
    <button type="button" onClick={onClick} className={`${base} ${styled}`}>
      {children}
      <span className="text-[10px] font-medium">{label}</span>
    </button>
  );
}

function BackgroundGridIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect
        width="28"
        height="20"
        rx="2"
        fill="white"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.5"
      />
      {Array.from({ length: 4 }).flatMap((_, i) =>
        Array.from({ length: 3 }).map((__, j) => (
          <circle key={`${i}-${j}`} cx={4 + i * 6} cy={4 + j * 6} r="0.8" fill="currentColor" />
        )),
      )}
    </svg>
  );
}

function BackgroundBlankIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect
        width="28"
        height="20"
        rx="2"
        fill="white"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.5"
      />
    </svg>
  );
}

function BackgroundLinesIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect
        width="28"
        height="20"
        rx="2"
        fill="white"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.5"
      />
      <line x1="2" y1="6" x2="26" y2="6" stroke="currentColor" strokeWidth="0.7" />
      <line x1="2" y1="11" x2="26" y2="11" stroke="currentColor" strokeWidth="0.7" />
      <line x1="2" y1="16" x2="26" y2="16" stroke="currentColor" strokeWidth="0.7" />
    </svg>
  );
}

function BackgroundGraphIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect
        width="28"
        height="20"
        rx="2"
        fill="white"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.5"
      />
      {[5, 10, 15].map((y) => (
        <line key={`h${y}`} x1="0" y1={y} x2="28" y2={y} stroke="currentColor" strokeWidth="0.4" />
      ))}
      {[5, 10, 15, 20, 25].map((x) => (
        <line key={`v${x}`} x1={x} y1="0" x2={x} y2="20" stroke="currentColor" strokeWidth="0.4" />
      ))}
    </svg>
  );
}

function BackgroundCrosshatchIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect
        width="28"
        height="20"
        rx="2"
        fill="white"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.5"
      />
      <line x1="0" y1="6" x2="22" y2="20" stroke="currentColor" strokeWidth="0.5" />
      <line x1="6" y1="0" x2="28" y2="14" stroke="currentColor" strokeWidth="0.5" />
      <line x1="0" y1="14" x2="14" y2="0" stroke="currentColor" strokeWidth="0.5" />
      <line x1="14" y1="20" x2="28" y2="6" stroke="currentColor" strokeWidth="0.5" />
    </svg>
  );
}

function BackgroundConfettiIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect
        width="28"
        height="20"
        rx="2"
        fill="white"
        stroke="currentColor"
        strokeWidth="0.5"
        opacity="0.5"
      />
      <circle cx="5" cy="6" r="1.3" fill="rgb(248 113 113)" />
      <circle cx="13" cy="4" r="1" fill="rgb(96 165 250)" />
      <circle cx="22" cy="8" r="1.3" fill="rgb(250 204 21)" />
      <circle cx="8" cy="14" r="1.3" fill="rgb(167 139 250)" />
      <circle cx="18" cy="13" r="1" fill="rgb(52 211 153)" />
      <circle cx="24" cy="16" r="1.3" fill="rgb(236 72 153)" />
    </svg>
  );
}

const ALIGN_GRID: { x: TextAlignX; y: TextAlignY }[] = [
  { y: 'top', x: 'left' },
  { y: 'top', x: 'center' },
  { y: 'top', x: 'right' },
  { y: 'middle', x: 'left' },
  { y: 'middle', x: 'center' },
  { y: 'middle', x: 'right' },
  { y: 'bottom', x: 'left' },
  { y: 'bottom', x: 'center' },
  { y: 'bottom', x: 'right' },
];

function alignLabel(x: TextAlignX, y: TextAlignY): string {
  const yLabel = y === 'top' ? 'Top' : y === 'bottom' ? 'Bottom' : 'Middle';
  const xLabel = x === 'left' ? 'left' : x === 'right' ? 'right' : 'centre';
  return `${yLabel} ${xLabel}`;
}

function AlignmentGrid({
  alignX,
  alignY,
  onChange,
}: {
  alignX: TextAlignX;
  alignY: TextAlignY;
  onChange: (x: TextAlignX, y: TextAlignY) => void;
}) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {ALIGN_GRID.map(({ x, y }) => {
        const active = alignX === x && alignY === y;
        return (
          <Tooltip
            key={`${y}-${x}`}
            title={alignLabel(x, y)}
            description="Align text to this corner of the element."
          >
            <button
              type="button"
              onClick={() => onChange(x, y)}
              aria-label={alignLabel(x, y)}
              aria-pressed={active}
              className={
                active
                  ? 'flex h-7 w-full items-center justify-center rounded-md bg-brand-100 text-brand-700'
                  : 'flex h-7 w-full items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-900'
              }
            >
              <AlignIcon x={x} y={y} />
            </button>
          </Tooltip>
        );
      })}
    </div>
  );
}

function AlignIcon({ x, y }: { x: TextAlignX; y: TextAlignY }) {
  const ix = x === 'left' ? 2 : x === 'right' ? 9 : 5.5;
  const iy = y === 'top' ? 3 : y === 'bottom' ? 10 : 6.5;
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden>
      <rect
        x="1"
        y="1"
        width="14"
        height="14"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1"
      />
      <rect x={ix} y={iy} width="5" height="3" rx="0.5" fill="currentColor" />
    </svg>
  );
}

function ColorSwatch({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  return (
    <label className="relative flex flex-1 cursor-pointer items-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100">
      <span
        aria-hidden
        className="h-4 w-4 rounded border border-slate-300"
        style={{ backgroundColor: value }}
      />
      <span className="flex-1">{label}</span>
      <input
        type="color"
        value={hexish(value)}
        onChange={(e) => onChange(e.target.value)}
        aria-label={`${label} color`}
        className="absolute h-0 w-0 opacity-0"
      />
    </label>
  );
}

function hexish(color: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) return color;
  return '#ffffff';
}

type IconButtonProps = {
  label: string;
  description: string;
  onClick: () => void;
  children: React.ReactNode;
  disabled?: boolean;
};

function IconButton({ label, description, onClick, children, disabled }: IconButtonProps) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className="flex h-9 w-9 items-center justify-center rounded-md text-slate-600 transition enabled:hover:bg-slate-100 enabled:hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
  if (disabled) return button;
  return (
    <Tooltip title={label} description={description}>
      {button}
    </Tooltip>
  );
}

function BringToFrontIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="2.5" width="7" height="7" rx="1" />
      <rect x="6.5" y="6.5" width="7" height="7" rx="1" fill="currentColor" fillOpacity="0.18" />
    </svg>
  );
}

function SendToBackIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2.5" y="2.5" width="7" height="7" rx="1" fill="currentColor" fillOpacity="0.18" />
      <rect x="6.5" y="6.5" width="7" height="7" rx="1" />
    </svg>
  );
}
