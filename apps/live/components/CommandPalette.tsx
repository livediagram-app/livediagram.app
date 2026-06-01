import { useState } from 'react';
import { useShowMoreList } from '@/hooks/useShowMoreList';
import type {
  ArrowEnds,
  ArrowheadSize,
  ArrowStyle,
  ArrowThickness,
  BackgroundPattern,
  BorderRadius,
  BorderStroke,
  BorderStyle,
  Padding,
  ShapeKind,
  TextAlignX,
  TextAlignY,
  TextSize,
} from '@livediagram/diagram';
import { ARROW_THICKNESS_PX, ARROWHEAD_SIZE_PX } from '@livediagram/diagram';
import { THEMES, type ThemeId } from '@/lib/themes';
import { MovablePanel } from './MovablePanel';
import { ShowMoreButton } from './ShowMoreButton';
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
  // Independent arrowhead size — separated from the line thickness so
  // users can pair a thin line with a chunky head (or vice versa).
  arrowheadSize: ArrowheadSize | null;
  onSetArrowheadSize: (size: ArrowheadSize) => void;
  // Path geometry: straight (default), curved (bezier bow), or angled
  // (axis-aligned right-angle elbow). Null when the selection isn't
  // an arrow.
  arrowStyle: ArrowStyle | null;
  onSetArrowStyle: (style: ArrowStyle) => void;
  // Non-null only when a shape element is selected. Drives the Shape
  // accordion's morph-into-this-kind grid.
  shapeKind: ShapeKind | null;
  onSetShapeKind: (kind: ShapeKind) => void;
  // Whether the selected boxed element's width/height ratio is
  // locked during resize. `null` when the selection is something
  // that doesn't support aspect-lock (e.g. arrows).
  aspectLocked: boolean | null;
  onToggleAspectLock: () => void;
  // Border presets. Non-null only when a shape is selected (text
  // elements have no border and stickies have a fixed peeled-corner
  // visual). The Border accordion renders three icon-button rows:
  // strength, pattern, radius.
  borderStroke: BorderStroke | null;
  borderStyle: BorderStyle | null;
  borderRadius: BorderRadius | null;
  onSetBorderStroke: (value: BorderStroke) => void;
  onSetBorderStyle: (value: BorderStyle) => void;
  onSetBorderRadius: (value: BorderRadius) => void;
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
  // Forcibly re-apply the active theme to every element on the tab,
  // overwriting any per-element custom colours the user set. Opt-in
  // counterpart to the normal Theme-pick flow, which preserves
  // customs. Surfaces as a "Reset elements to theme" button under
  // the theme grid.
  onResetElementsToTheme: () => void;
  // File I/O — moved from the editor header into the Current Tab
  // section so theme / canvas / file controls all live in the same
  // panel. Both optional so callers without the routing wired (e.g.
  // welcome-flow surfaces) can omit them.
  onExportTab?: () => void;
  onImportTab?: () => void;
  importError?: string | null;
};

export type CanvasTool = 'pan' | 'select' | 'laser';

type CommandPaletteProps = {
  position: { x: number; y: number } | null;
  minimized: boolean;
  canvasTool: CanvasTool;
  onSetCanvasTool: (tool: CanvasTool) => void;
  onMoveTo: (x: number, y: number) => void;
  onToggleMinimized: () => void;
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
  canvasTool,
  onSetCanvasTool,
  onMoveTo,
  onToggleMinimized,
  onReset,
  onAddShape,
  onAddText,
  onAddSticky,
  onAddArrow,
}: CommandPaletteProps) {
  // The Selected Element / Current Tab sections moved out into the
  // ContextPanel (bottom-right, above zoom). The palette now hosts
  // the canvas-tool toggle row at the top, the general Shapes row
  // (always visible: the most common entry point on every fresh
  // canvas), and two collapsible accordions below for situational
  // adds: Tools (text + arrow + sticky) and Devices (wireframing
  // device frames). Mutually exclusive: opening Tools closes
  // Devices and vice versa, same pattern as the
  // SelectedElementSection's accordions, so the palette stays
  // compact.
  const [paletteOpen, setPaletteOpen] = useState({
    tools: false,
    devices: false,
  });
  const togglePalette = (key: 'tools' | 'devices') =>
    setPaletteOpen((prev) => {
      const closed = { tools: false, devices: false };
      if (prev[key]) return closed;
      return { ...closed, [key]: true };
    });
  return (
    <MovablePanel
      title="Palette"
      position={position}
      defaultCorner="top-right"
      width="w-64"
      onReset={onReset}
      onMoveTo={onMoveTo}
      onMinimize={onToggleMinimized}
    >
      {/* Canvas tool toggle (Pan / Select / Laser). Lives above the
          accordions as a permanent row because these are mode
          switches, not element-add buttons. Pan is the default; Space
          pans regardless of the active tool, mirroring Figma. */}
      <div className="flex items-center gap-1 px-2 pb-1.5 pt-1">
        <Tooltip title="Pan" description="Drag to scroll. Space pans in Select mode too.">
          <ToolButton
            active={canvasTool === 'pan'}
            label="Pan"
            onClick={() => onSetCanvasTool('pan')}
          >
            <PanIcon />
          </ToolButton>
        </Tooltip>
        <Tooltip title="Select" description="Drag to marquee-select multiple elements.">
          <ToolButton
            active={canvasTool === 'select'}
            label="Select"
            onClick={() => onSetCanvasTool('select')}
          >
            <SelectIcon />
          </ToolButton>
        </Tooltip>
        <Tooltip
          title="Laser"
          description="Presenter pointer. Move the mouse to draw a glowing trail visible to other participants in your colour."
        >
          <ToolButton
            active={canvasTool === 'laser'}
            label="Laser"
            onClick={() => onSetCanvasTool('laser')}
          >
            <LaserIcon />
          </ToolButton>
        </Tooltip>
      </div>
      {/* Shapes are always visible above the accordions: they're the
          most common entry point on every fresh canvas and tucking
          them behind a collapsible header buried a click for no
          payoff. Tools and Devices stay accordion'd because they're
          situational. Ordered by frequency / familiarity: primitive
          geometry first, then flowchart-vocabulary shapes. */}
      <div className="border-t border-slate-100 px-3 pb-2 pt-2">
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
            description="Diamond. Decision node."
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
            description="Cylinder. Flowchart database / storage."
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
            description="Parallelogram. Flowchart input / output."
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
            description="Hexagon. Preparation / milestone."
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
            description="Document shape. Flowchart output."
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
            description="Stadium shape. Flowchart Start / End."
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
          <IconButton
            label="Add user"
            description="User / actor. Use-case and architecture diagrams."
            onClick={() => onAddShape('actor')}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <circle cx="9" cy="4" r="2.4" />
              <path d="M9 6.4 L9 11.5" />
              <path d="M4.8 8.4 L13.2 8.4" />
              <path d="M9 11.5 L6 15.5" />
              <path d="M9 11.5 L12 15.5" />
            </svg>
          </IconButton>
          <IconButton
            label="Add cloud"
            description="Cloud. Networking / architecture."
            onClick={() => onAddShape('cloud')}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
              aria-hidden
            >
              <path d="M5.5 13.5 C3.2 13.5 2 11.7 3.4 10.2 C2.4 8.7 4 7 5.5 7.7 C6 5.4 9.4 5.2 9.9 7.6 C11.9 6.7 13.5 8.6 12.2 10.2 C13.5 11.2 12.6 13.5 10.8 13.5 Z" />
            </svg>
          </IconButton>
        </div>
      </div>
      <Accordion title="Tools" open={paletteOpen.tools} onToggle={() => togglePalette('tools')}>
        <div className="flex items-center gap-1">
          <IconButton
            label="Add text"
            description="Text element. Double-click to edit."
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
            description="Plain connector. Add pointers in the Pointer accordion."
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
            description="Sticky note for short annotations."
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
      </Accordion>
      <Accordion
        title="Devices"
        open={paletteOpen.devices}
        onToggle={() => togglePalette('devices')}
      >
        {/* Wireframing primitives. Each renders as the device's
            silhouette so the user can drop it as a container and
            arrange interface elements inside. See spec/09 "Devices". */}
        <div className="flex flex-wrap items-center gap-1">
          <IconButton
            label="Add web browser"
            description="Browser window. Wireframe a web page or a web-app screen."
            onClick={() => onAddShape('browser')}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="2" y="3" width="14" height="12" rx="1.5" />
              <path d="M2 7 L16 7" />
            </svg>
          </IconButton>
          <IconButton
            label="Add computer monitor"
            description="Desktop monitor with stand. Wireframe a desktop app."
            onClick={() => onAddShape('monitor')}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="2" y="2.5" width="14" height="9" rx="1" />
              <path d="M6 15.5 L12 15.5" />
              <path d="M9 11.5 L9 15.5" />
            </svg>
          </IconButton>
          <IconButton
            label="Add laptop"
            description="Laptop. Screen plus keyboard base."
            onClick={() => onAddShape('laptop')}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="3.5" y="3" width="11" height="8" rx="1" />
              <path d="M1.5 14 L16.5 14 L15 11 L3 11 Z" />
            </svg>
          </IconButton>
          <IconButton
            label="Add phone"
            description="Phone. Wireframe a mobile screen."
            onClick={() => onAddShape('phone')}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="5.5" y="1.5" width="7" height="15" rx="1.6" />
            </svg>
          </IconButton>
          <IconButton
            label="Add tablet"
            description="Tablet. Larger than a phone, smaller than a laptop screen."
            onClick={() => onAddShape('tablet')}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="3" y="2" width="12" height="14" rx="1.2" />
            </svg>
          </IconButton>
        </div>
      </Accordion>
    </MovablePanel>
  );
}

export type SelectedAccordionState = {
  shape: boolean;
  layer: boolean;
  text: boolean;
  colours: boolean;
  border: boolean;
  pointer: boolean;
};

export function SelectedElementSection({
  selection,
  open,
  setOpen,
  scope = 'single',
}: {
  selection: SelectedElementControls;
  open: SelectedAccordionState;
  setOpen: React.Dispatch<React.SetStateAction<SelectedAccordionState>>;
  // Drives the section's heading: a one-off select is "Selected
  // Element", a marquee selection is "Selected Elements", and a
  // group selection is "Selected Group". Default keeps the old
  // single-element wording when callers don't pass it.
  scope?: 'single' | 'multi' | 'group';
}) {
  const heading =
    scope === 'group'
      ? 'Selected Group'
      : scope === 'multi'
        ? 'Selected Elements'
        : 'Selected Element';
  // Mutually exclusive: opening an accordion closes every other one.
  // Same key being toggled flips it shut. Keeps the panel compact
  // even when several accordion-eligible sections apply.
  const toggle = (key: keyof SelectedAccordionState) =>
    setOpen((prev) => {
      const closed: SelectedAccordionState = {
        shape: false,
        layer: false,
        text: false,
        colours: false,
        border: false,
        pointer: false,
      };
      if (prev[key]) return closed;
      return { ...closed, [key]: true };
    });

  const showText = selection.textSize !== null || selection.textAlignX !== null;
  const showColours =
    selection.textColor !== null || selection.fillColor !== null || selection.strokeColor !== null;

  return (
    <div className="flex flex-col border-t border-slate-200">
      <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {heading}
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
        <div className="my-2 h-px bg-slate-100" />
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
            className="mt-2 inline-flex w-full items-center justify-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50"
          >
            Reset to theme
          </button>
        </Accordion>
      ) : null}

      {/* Border accordion: visible when a shape is selected (shapes
          carry the strokeWidth / strokeStyle / borderRadius fields).
          Mirrors the Pointer accordion's icon-button-row pattern so
          shape borders feel like a peer of arrow pointers. */}
      {selection.borderStroke !== null &&
      selection.borderStyle !== null &&
      selection.borderRadius !== null ? (
        <Accordion title="Border" open={open.border} onToggle={() => toggle('border')}>
          <p className="text-[10px] font-medium text-slate-500">Strength</p>
          <div className="mt-1 grid grid-cols-4 gap-1">
            {(['thin', 'medium', 'thick', 'extra-thick'] as const).map((value) => (
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
          <p className="mt-3 text-[10px] font-medium text-slate-500">Pattern</p>
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
          <p className="mt-3 text-[10px] font-medium text-slate-500">Radius</p>
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
          {selection.arrowStyle !== null ? (
            <>
              <p className="text-[10px] font-medium text-slate-500">Line style</p>
              <div className="mt-1 grid grid-cols-3 gap-1">
                {(
                  [
                    ['straight', 'Straight', 'Plain straight line — the default.'],
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
          {selection.arrowheadSize !== null && selection.arrowEnds !== 'none' ? (
            <>
              <div className="my-2 h-px bg-slate-100" />
              <p className="text-[10px] font-medium text-slate-500">Arrowhead size</p>
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
  actor: 'User',
  cloud: 'Cloud',
  browser: 'Web browser',
  monitor: 'Computer monitor',
  laptop: 'Laptop',
  phone: 'Phone',
  tablet: 'Tablet',
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
    case 'actor':
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <circle cx="8" cy="3.4" r="2" />
          <path d="M8 5.4 L8 10" />
          <path d="M4.5 7.2 L11.5 7.2" />
          <path d="M8 10 L5.5 13.6" />
          <path d="M8 10 L10.5 13.6" />
        </svg>
      );
    case 'cloud':
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M5 12 C3 12 2 10.5 3.2 9.3 C2.3 8 3.7 6.6 5 7.2 C5.4 5.2 8.4 5 8.8 7.1 C10.6 6.3 12 8 10.9 9.3 C12 10.2 11.2 12 9.6 12 Z" />
        </svg>
      );
    case 'browser':
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="2" y="3" width="12" height="10" rx="1.5" />
          <path d="M2 6 L14 6" />
        </svg>
      );
    case 'monitor':
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="2" y="2.5" width="12" height="8" rx="1" />
          <path d="M5.5 13.5 L10.5 13.5" />
          <path d="M8 10.5 L8 13.5" />
        </svg>
      );
    case 'laptop':
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="3" y="3" width="10" height="7" rx="0.8" />
          <path d="M1.5 12.5 L14.5 12.5 L13.5 10 L2.5 10 Z" />
        </svg>
      );
    case 'phone':
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="5" y="1.5" width="6" height="13" rx="1.4" />
        </svg>
      );
    case 'tablet':
      return (
        <svg
          width="14"
          height="14"
          viewBox="0 0 16 16"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.3"
          strokeLinejoin="round"
          aria-hidden
        >
          <rect x="3" y="2" width="10" height="12" rx="1" />
        </svg>
      );
  }
}

// Border-accordion labels + glyphs. Three rows: stroke strength,
// stroke pattern, corner radius. Each glyph renders a horizontal
// line / squiggle whose visual weight or pattern hints at the preset
// the button maps to, matching the Pointer accordion's row
// conventions so the two reads as siblings.

const BORDER_STROKE_LABEL: Record<BorderStroke, string> = {
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

function BorderStrokeIcon({ value }: { value: BorderStroke }) {
  const sw = { thin: 1, medium: 2, thick: 4, 'extra-thick': 7 }[value];
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <line
        x1="2"
        y1="9"
        x2="16"
        y2="9"
        stroke="currentColor"
        strokeWidth={sw}
        strokeLinecap="round"
      />
    </svg>
  );
}

function BorderStyleIcon({ value }: { value: BorderStyle }) {
  const dash = value === 'solid' ? undefined : value === 'dashed' ? '4 3' : '1.5 2.5';
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <line
        x1="2"
        y1="9"
        x2="16"
        y2="9"
        stroke="currentColor"
        strokeWidth="2"
        strokeDasharray={dash}
        strokeLinecap="round"
      />
    </svg>
  );
}

function BorderRadiusIcon({ value }: { value: BorderRadius }) {
  const rx = { none: 0, sm: 2, md: 4.5, lg: 7 }[value];
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <rect
        x="3"
        y="3"
        width="12"
        height="12"
        rx={rx}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
    </svg>
  );
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

// Mini chevron sized to the preset px so users can compare the
// pointer sizes visually before picking. Uses the same path shape as
// the real arrowhead marker so what you see is what you get.
function ArrowheadSizeIcon({ px }: { px: number }) {
  return (
    <svg width="22" height="14" viewBox="0 0 22 14" fill="none" aria-hidden>
      <line x1="3" y1="7" x2="14" y2="7" stroke="currentColor" strokeWidth="1.6" />
      <path d={`M 14 ${7 - px / 2} L ${14 + px} 7 L 14 ${7 + px / 2} z`} fill="currentColor" />
    </svg>
  );
}

// 22×14 thumbnail of each path style. Reuses currentColor so the icon
// follows the SizeButton's active/inactive colour.
function ArrowStyleIcon({ style }: { style: ArrowStyle }) {
  if (style === 'straight') {
    return (
      <svg width="22" height="14" viewBox="0 0 22 14" fill="none" aria-hidden>
        <path d="M 3 7 L 19 7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  if (style === 'curved') {
    return (
      <svg width="22" height="14" viewBox="0 0 22 14" fill="none" aria-hidden>
        <path
          d="M 3 10 Q 11 -1 19 10"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="22" height="14" viewBox="0 0 22 14" fill="none" aria-hidden>
      <path
        d="M 3 11 L 11 11 L 11 3 L 19 3"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// Small circular-arrow glyph used by the "Reset elements to theme"
// button under the Theme accordion. 12×12 inside a 14×14 box.
function ResetIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M3 8 a5 5 0 1 0 1.5 -3.5" />
      <polyline points="2,2 4,4.5 6.5,3.5" />
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

export type TabAccordionState = { theme: boolean; canvas: boolean; file: boolean };

export function TabSection({
  tab,
  open,
  setOpen,
}: {
  tab: TabSectionControls;
  open: TabAccordionState;
  setOpen: React.Dispatch<React.SetStateAction<TabAccordionState>>;
}) {
  // Mutually exclusive (matches SelectedElementSection).
  const toggle = (key: keyof TabAccordionState) =>
    setOpen((prev) => {
      const closed: TabAccordionState = { theme: false, canvas: false, file: false };
      if (prev[key]) return closed;
      return { ...closed, [key]: true };
    });

  // Same opt-in shape as the welcome / template picker. Auto-expands
  // when the current tab is already on an extra so the active swatch
  // is always visible.
  const themesList = useShowMoreList(THEMES, (t) => t.id === tab.themeId);
  const patternsList = useShowMoreList(PATTERNS, (p) => p.id === tab.backgroundPattern);

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
          {themesList.visible.map((t) => {
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
        {themesList.hasMore && !themesList.showAll ? (
          <ShowMoreButton label="Show more themes" onClick={themesList.reveal} />
        ) : null}
        <div className="my-2 h-px bg-slate-100" />
        <Tooltip
          title="Reset elements to theme"
          description="Recolour every shape, text and arrow on this tab to the active theme's defaults — including elements you've hand-coloured."
        >
          <button
            type="button"
            onClick={tab.onResetElementsToTheme}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700"
          >
            <ResetIcon />
            Reset elements to theme
          </button>
        </Tooltip>
      </Accordion>
      <Accordion title="Canvas" open={open.canvas} onToggle={() => toggle('canvas')}>
        <p className="text-[10px] font-medium text-slate-500">Pattern</p>
        <div className="mt-1 grid grid-cols-3 gap-1">
          {patternsList.visible.map((p) => (
            <Tooltip key={p.id} title={p.label} description={p.description}>
              <PatternButton
                active={tab.backgroundPattern === p.id}
                onClick={() => tab.onSetBackgroundPattern(p.id)}
                label={p.shortLabel}
              >
                <p.icon />
              </PatternButton>
            </Tooltip>
          ))}
        </div>
        {patternsList.hasMore && !patternsList.showAll ? (
          <ShowMoreButton label="Show more patterns" onClick={patternsList.reveal} />
        ) : null}
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
      {tab.onExportTab || tab.onImportTab ? (
        <Accordion title="Import / Export" open={open.file} onToggle={() => toggle('file')}>
          <div className="flex items-stretch gap-1.5">
            {tab.onImportTab ? (
              <Tooltip title="Import tab" description="Drop a .json tab into this diagram." block>
                <button
                  type="button"
                  onClick={tab.onImportTab}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700"
                >
                  <FileImportIcon />
                  Import
                </button>
              </Tooltip>
            ) : null}
            {tab.onExportTab ? (
              <Tooltip title="Export tab" description="Save as Markdown, PDF, PNG, or .json." block>
                <button
                  type="button"
                  onClick={tab.onExportTab}
                  className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700"
                >
                  <FileExportIcon />
                  Export
                </button>
              </Tooltip>
            ) : null}
          </div>
          {tab.importError ? (
            <p className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-700">
              {tab.importError}
            </p>
          ) : null}
        </Accordion>
      ) : null}
    </div>
  );
}

function FileImportIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 13.5V5.5" />
      <path d="M5 10.5l3 3 3-3" />
      <path d="M2.5 3v-0.5h11V3" />
    </svg>
  );
}

function FileExportIcon() {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M8 2v8" />
      <path d="M5 5l3-3 3 3" />
      <path d="M2.5 11v2.5h11V11" />
    </svg>
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

function LaserIcon() {
  // Stylised laser pointer: a beam emerging from a small body in the
  // bottom-left toward a glowing dot in the top-right.
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
      <path d="M2.5 13.5l8-8" />
      <circle cx="11.5" cy="4.5" r="1.4" fill="currentColor" stroke="none" />
      <path d="M10 3.2l.7-1" strokeWidth="1.2" />
      <path d="M12.8 3l1-.4" strokeWidth="1.2" />
      <path d="M12.8 6l1 .4" strokeWidth="1.2" />
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
  // Stretches to fill its parent grid cell so the row reads as four
  // equal-width controls rather than four shrink-to-fit pills floating
  // at the start of the row.
  const base =
    'flex w-full items-center justify-center rounded-md px-1.5 py-1 text-xs font-medium transition';
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

function BackgroundStripesIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect width="28" height="20" rx="2" fill="white" stroke="currentColor" strokeWidth="0.5" />
      {[6, 12, 18, 24].map((x) => (
        <line key={x} x1={x} y1="3" x2={x} y2="17" stroke="currentColor" strokeWidth="0.75" />
      ))}
    </svg>
  );
}

function BackgroundDiagonalIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect width="28" height="20" rx="2" fill="white" stroke="currentColor" strokeWidth="0.5" />
      {[-6, 0, 6, 12, 18, 24].map((x) => (
        <line key={x} x1={x} y1="20" x2={x + 16} y2="4" stroke="currentColor" strokeWidth="0.75" />
      ))}
    </svg>
  );
}

function BackgroundWavesIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect width="28" height="20" rx="2" fill="white" stroke="currentColor" strokeWidth="0.5" />
      {[6, 12, 17].map((y) => (
        <path
          key={y}
          d={`M2 ${y} Q 8 ${y - 2.5} 14 ${y} T 26 ${y}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="0.7"
        />
      ))}
    </svg>
  );
}

function BackgroundBricksIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect width="28" height="20" rx="2" fill="white" stroke="currentColor" strokeWidth="0.5" />
      {/* Row 1 — full cells. */}
      <line x1="2" y1="6" x2="26" y2="6" stroke="currentColor" strokeWidth="0.75" />
      <line x1="2" y1="14" x2="26" y2="14" stroke="currentColor" strokeWidth="0.75" />
      <line x1="10" y1="2" x2="10" y2="6" stroke="currentColor" strokeWidth="0.75" />
      <line x1="18" y1="2" x2="18" y2="6" stroke="currentColor" strokeWidth="0.75" />
      <line x1="6" y1="6" x2="6" y2="14" stroke="currentColor" strokeWidth="0.75" />
      <line x1="14" y1="6" x2="14" y2="14" stroke="currentColor" strokeWidth="0.75" />
      <line x1="22" y1="6" x2="22" y2="14" stroke="currentColor" strokeWidth="0.75" />
      <line x1="10" y1="14" x2="10" y2="18" stroke="currentColor" strokeWidth="0.75" />
      <line x1="18" y1="14" x2="18" y2="18" stroke="currentColor" strokeWidth="0.75" />
    </svg>
  );
}

function BackgroundPlusIcon() {
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect width="28" height="20" rx="2" fill="white" stroke="currentColor" strokeWidth="0.5" />
      {[
        { x: 7, y: 6 },
        { x: 21, y: 6 },
        { x: 14, y: 13 },
      ].map((c) => (
        <g key={`${c.x}-${c.y}`} stroke="currentColor" strokeWidth="0.9" strokeLinecap="round">
          <line x1={c.x - 2} y1={c.y} x2={c.x + 2} y2={c.y} />
          <line x1={c.x} y1={c.y - 2} x2={c.x} y2={c.y + 2} />
        </g>
      ))}
    </svg>
  );
}

function BackgroundStarsIcon() {
  // Tiny five-point stars sized to read as decorative sprinkles.
  const star = (cx: number, cy: number, key: string) => {
    const r = 2;
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI) / 5 - Math.PI / 2;
      const radius = i % 2 === 0 ? r : r * 0.45;
      pts.push(`${cx + radius * Math.cos(angle)},${cy + radius * Math.sin(angle)}`);
    }
    return <polygon key={key} points={pts.join(' ')} fill="currentColor" />;
  };
  return (
    <svg width="28" height="20" viewBox="0 0 28 20" aria-hidden>
      <rect width="28" height="20" rx="2" fill="white" stroke="currentColor" strokeWidth="0.5" />
      {star(7, 6, 'a')}
      {star(20, 5, 'b')}
      {star(14, 13, 'c')}
      {star(23, 15, 'd')}
    </svg>
  );
}

// One entry per pattern, with the `extra` flag driving the Show more
// toggle. New patterns slot in by editing this list — the picker UI
// has no hard-coded ids.
type PatternEntry = {
  id: BackgroundPattern;
  label: string;
  shortLabel: string;
  description: string;
  icon: () => React.ReactElement;
  extra?: boolean;
};

const PATTERNS: PatternEntry[] = [
  {
    id: 'grid',
    label: 'Grid',
    shortLabel: 'Grid',
    description: 'Subtle dot grid background.',
    icon: BackgroundGridIcon,
  },
  {
    id: 'blank',
    label: 'Blank',
    shortLabel: 'Blank',
    description: 'No background pattern.',
    icon: BackgroundBlankIcon,
  },
  {
    id: 'lines',
    label: 'Lines',
    shortLabel: 'Lines',
    description: 'Horizontal ruled lines.',
    icon: BackgroundLinesIcon,
  },
  {
    id: 'graph',
    label: 'Graph',
    shortLabel: 'Graph',
    description: 'Square graph paper.',
    icon: BackgroundGraphIcon,
  },
  {
    id: 'crosshatch',
    label: 'Crosshatch',
    shortLabel: 'Cross',
    description: 'Diagonal crosshatch pattern.',
    icon: BackgroundCrosshatchIcon,
  },
  {
    id: 'confetti',
    label: 'Confetti',
    shortLabel: 'Confetti',
    description: 'Multi-colour dots — pattern colour ignored.',
    icon: BackgroundConfettiIcon,
  },
  {
    id: 'stripes',
    label: 'Stripes',
    shortLabel: 'Stripes',
    description: 'Vertical ruled lines.',
    extra: true,
    icon: BackgroundStripesIcon,
  },
  {
    id: 'diagonal',
    label: 'Diagonal',
    shortLabel: 'Diagonal',
    description: 'Single-direction 45° lines.',
    extra: true,
    icon: BackgroundDiagonalIcon,
  },
  {
    id: 'waves',
    label: 'Waves',
    shortLabel: 'Waves',
    description: 'Gentle sinusoidal lines — softest of the textures.',
    extra: true,
    icon: BackgroundWavesIcon,
  },
  {
    id: 'bricks',
    label: 'Bricks',
    shortLabel: 'Bricks',
    description: 'Offset masonry brickwork.',
    extra: true,
    icon: BackgroundBricksIcon,
  },
  {
    id: 'plus',
    label: 'Plus',
    shortLabel: 'Plus',
    description: 'Sprinkled plus signs.',
    extra: true,
    icon: BackgroundPlusIcon,
  },
  {
    id: 'stars',
    label: 'Stars',
    shortLabel: 'Stars',
    description: 'Sprinkled five-point stars.',
    extra: true,
    icon: BackgroundStarsIcon,
  },
];

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
