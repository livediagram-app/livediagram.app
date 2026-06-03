import { useState } from 'react';
import { useShowMoreList } from '@/hooks/useShowMoreList';
import {
  Accordion,
  PATTERNS,
  AlignmentGrid,
  ColorSwatch,
  IconButton,
  LabelButton,
  PatternButton,
  SizeButton,
  ToolButton,
} from './palette-controls';
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
import {
  ArrowEndsIcon,
  ArrowheadSizeIcon,
  ArrowStyleIcon,
  AutoAlignIcon,
  BoldIcon,
  BorderRadiusIcon,
  BorderStrokeIcon,
  BorderStyleIcon,
  BringToFrontIcon,
  DotsIcon,
  ItalicIcon,
  LaserIcon,
  NonePaddingIcon,
  PaddingIcon,
  PanIcon,
  ResetIcon,
  ScaleIcon,
  SelectIcon,
  SendToBackIcon,
  ShapeIcon,
  StrikethroughIcon,
  ThicknessIcon,
  UnderlineIcon,
} from './palette-icons';
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
  // Line pattern (solid / dashed / dotted) on the arrow stroke.
  // Shares the BorderStyle union with the shape Border accordion's
  // pattern row so the same icon set lights up either way.
  arrowStrokeStyle: BorderStyle | null;
  onSetArrowStrokeStyle: (style: BorderStyle) => void;
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
  // Surfaces the "import .json failed" message that used to live
  // inside the now-removed Import/Export accordion. The error itself
  // still originates from the TabBar's ellipsis-menu Import action;
  // we just render the inline note here when one's pending.
  importError?: string | null;
  // "Auto align" pass: snaps every element's position + dimensions
  // to the 10px grid so almost-aligned shapes become exactly aligned
  // and minor size drift collapses. See lib/auto-align.ts. Lives in
  // the renamed "Assistant" accordion now. Hidden when missing.
  onAutoAlign?: () => void;
  // True when the active tab has at least one boxed element. When
  // false the button is disabled, the action would be a no-op.
  canAutoAlign?: boolean;
};

export type CanvasTool = 'pan' | 'select' | 'laser';

type CommandPaletteProps = {
  position: { x: number; y: number } | null;
  canvasTool: CanvasTool;
  onSetCanvasTool: (tool: CanvasTool) => void;
  onMoveTo: (x: number, y: number) => void;
  onReset: () => void;
  onAddShape: (kind: ShapeKind) => void;
  onAddText: () => void;
  onAddSticky: () => void;
  // Spawn an image placeholder + open the picker. Optional so
  // deployments without R2 (or view-role visitors) can omit it; the
  // Image palette entry hides when the handler is missing. See
  // spec/19.
  onAddImage?: () => void;
  // Drops a horizontal arrow at the viewport centre with no pointers
  // on either end by default (i.e. a plain line). Users can flip the
  // arrowEnds afterwards via the Pointer accordion.
  onAddArrow: () => void;
  // Pencil tool: enters one-shot freehand draw mode. Unlike the
  // other add-element callbacks, this never drops at the viewport
  // centre, the pencil is gestural by design. See spec/09 Pencil
  // (freehand) subsection.
  onBeginFreehand: () => void;
  // Currently-queued draw-to-size intent, or null. When set, the
  // matching palette button (shape, text, sticky, image, arrow)
  // renders pressed so the user can see what's queued for the next
  // canvas drag. Only populated when user-preferences.drawToAdd is
  // on; otherwise null and no button shows the pressed treatment.
  pendingDraw?:
    | { type: 'shape'; kind: ShapeKind }
    | { type: 'text' | 'sticky' | 'image' | 'arrow' | 'freehand' }
    | null;
  // Optional callback fired with the palette's current bounding box
  // whenever it changes (via MovablePanel's ResizeObserver). Canvas
  // wires this up so the ContextPanel can stack dynamically below
  // the palette as accordions open / close.
  onSize?: (size: { width: number; height: number; bottomY: number }) => void;
  // Mobile-only top override (the palette banner sits below the
  // Explorer banner so signed-out users can switch diagrams without
  // leaving the canvas). See MovablePanel for semantics.
  mobileTopOverridePx?: number;
};

export function CommandPalette({
  position,
  canvasTool,
  onSetCanvasTool,
  onMoveTo,
  onReset,
  onAddShape,
  onAddText,
  onAddSticky,
  onAddImage,
  onAddArrow,
  onBeginFreehand,
  pendingDraw,
  onSize,
  mobileTopOverridePx,
}: CommandPaletteProps) {
  const pendingShapeKind = pendingDraw && pendingDraw.type === 'shape' ? pendingDraw.kind : null;
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
      width="w-auto sm:w-64"
      onSize={onSize}
      mobileTopOverridePx={mobileTopOverridePx}
      onReset={onReset}
      onMoveTo={onMoveTo}
      collapsible
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
            shortcut="P"
          >
            <PanIcon />
          </ToolButton>
        </Tooltip>
        <Tooltip title="Select" description="Drag to marquee-select multiple elements.">
          <ToolButton
            active={canvasTool === 'select'}
            label="Select"
            onClick={() => onSetCanvasTool('select')}
            shortcut="S"
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
            shortcut="L"
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
      <div className="border-t border-slate-100 px-2 pb-2 pt-2 sm:px-3 dark:border-slate-800">
        <div className="flex flex-wrap items-center gap-0.5 sm:gap-1">
          <IconButton
            label="Add square"
            description="Drop a new square shape on the canvas."
            onClick={() => onAddShape('square')}
            active={pendingShapeKind === 'square'}
            shortcut="R"
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
            active={pendingShapeKind === 'circle'}
            shortcut="O"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
              <circle cx="9" cy="9" r="6" fill="none" stroke="currentColor" strokeWidth="2" />
            </svg>
          </IconButton>
          <IconButton
            label="Add diamond"
            description="Diamond. Decision node."
            onClick={() => onAddShape('diamond')}
            active={pendingShapeKind === 'diamond'}
            shortcut="D"
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
            active={pendingShapeKind === 'cylinder'}
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
            active={pendingShapeKind === 'parallelogram'}
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
            active={pendingShapeKind === 'hexagon'}
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
            active={pendingShapeKind === 'document'}
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
            active={pendingShapeKind === 'stadium'}
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
            label="Add cloud"
            description="Cloud. Networking / architecture."
            onClick={() => onAddShape('cloud')}
            active={pendingShapeKind === 'cloud'}
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
            active={pendingDraw?.type === 'text'}
            shortcut="T"
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
            label="Pencil (freehand)"
            description="Sketch a freehand stroke. Drag to draw; release near the start to close the shape."
            onClick={onBeginFreehand}
            active={pendingDraw?.type === 'freehand'}
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
              {/* Diagonal pencil. Body angled bottom-left to
                  top-right, with a separated tip + eraser segment
                  so the silhouette reads as "pencil" even at the
                  18 px palette size. Pairs with the cursor glyph
                  (also a diagonal nib) so the tool's two visual
                  surfaces stay in sync. */}
              <path d="M2 16 L6 12" />
              <path d="M5 13 L12 6 L14 8 L7 15 Z" />
              <path d="M12 6 L15 3 L17 5 L14 8" />
              <path d="M2 16 L5 13" />
            </svg>
          </IconButton>
          <IconButton
            label="Add arrow"
            description="Plain connector. Add pointers in the Pointer accordion."
            onClick={onAddArrow}
            active={pendingDraw?.type === 'arrow'}
            shortcut="A"
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
            active={pendingDraw?.type === 'sticky'}
            shortcut="N"
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
          {onAddImage ? (
            <IconButton
              label="Add image"
              description="Drop an image placeholder + pick / upload a file."
              onClick={onAddImage}
              active={pendingDraw?.type === 'image'}
              shortcut="I"
            >
              <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                <rect
                  x="2.5"
                  y="3"
                  width="13"
                  height="12"
                  rx="1.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                />
                <circle cx="7" cy="7" r="1.25" fill="currentColor" />
                <path
                  d="M2.5 12 L6.5 8.5 L10 11 L13 8 L15.5 10.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              </svg>
            </IconButton>
          ) : null}
          <IconButton
            label="Add user"
            description="User / actor. Use-case and architecture diagrams."
            onClick={() => onAddShape('actor')}
            active={pendingShapeKind === 'actor'}
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
            active={pendingShapeKind === 'browser'}
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
            active={pendingShapeKind === 'monitor'}
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
            active={pendingShapeKind === 'laptop'}
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
            active={pendingShapeKind === 'phone'}
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
            active={pendingShapeKind === 'tablet'}
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
      if (prev[key]) return ALL_SELECTED_ACCORDIONS_CLOSED;
      return { ...ALL_SELECTED_ACCORDIONS_CLOSED, [key]: true };
    });

  const showText = selection.textSize !== null || selection.textAlignX !== null;
  const showColours =
    selection.textColor !== null || selection.fillColor !== null || selection.strokeColor !== null;

  return (
    <div className="flex flex-col border-t border-slate-200 dark:border-slate-800">
      <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">
        {heading}
      </p>

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
          carry the strokeWidth / strokeStyle / borderRadius fields).
          Mirrors the Pointer accordion's icon-button-row pattern so
          shape borders feel like a peer of arrow pointers. */}
      {selection.borderStroke !== null &&
      selection.borderStyle !== null &&
      selection.borderRadius !== null ? (
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
          <p className="mt-3 text-[10px] font-medium text-slate-500 dark:text-slate-300">Radius</p>
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
          : 'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full bg-slate-300 transition dark:bg-slate-600'
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

export type TabAccordionState = {
  theme: boolean;
  canvas: boolean;
  cleanup: boolean;
};

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
      const closed: TabAccordionState = {
        theme: false,
        canvas: false,
        cleanup: false,
      };
      if (prev[key]) return closed;
      return { ...closed, [key]: true };
    });

  // Same opt-in shape as the welcome / template picker. Auto-expands
  // when the current tab is already on an extra so the active swatch
  // is always visible.
  const themesList = useShowMoreList(THEMES, (t) => t.id === tab.themeId);
  const patternsList = useShowMoreList(PATTERNS, (p) => p.id === tab.backgroundPattern);

  return (
    <div className="flex flex-col border-t border-slate-200 dark:border-slate-800">
      <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-200">
        Current Tab
      </p>
      <Accordion title="Theme" open={open.theme} onToggle={() => toggle('theme')}>
        <p className="text-[10px] font-medium text-slate-500 dark:text-slate-300">
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
                      : 'flex w-full flex-col items-center gap-1 rounded-md border border-slate-200 bg-white p-1.5 text-[10px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15'
                  }
                >
                  <span
                    aria-hidden
                    style={{ backgroundColor: t.backgroundColor }}
                    className="flex h-7 w-full items-center justify-center rounded-sm border border-slate-200 dark:border-slate-700"
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
        <div className="my-2 h-px bg-slate-100 dark:bg-slate-800" />
        <Tooltip
          title="Reset elements to theme"
          description="Recolour every shape, text and arrow on this tab to the active theme's defaults — including elements you've hand-coloured."
        >
          <button
            type="button"
            onClick={tab.onResetElementsToTheme}
            className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15 dark:hover:text-brand-200"
          >
            <ResetIcon />
            Reset elements to theme
          </button>
        </Tooltip>
      </Accordion>
      <Accordion title="Canvas" open={open.canvas} onToggle={() => toggle('canvas')}>
        <p className="text-[10px] font-medium text-slate-500 dark:text-slate-300">Pattern</p>
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
        <p className="mt-3 border-t border-slate-100 pt-3 text-[10px] font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
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
            <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">Opacity</p>
            <span className="text-[10px] font-medium text-slate-500 dark:text-slate-300">
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
            className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-brand-500 dark:bg-slate-700"
          />
        </div>
      </Accordion>
      {tab.importError ? (
        <p className="rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-700">
          {tab.importError}
        </p>
      ) : null}
      {tab.onAutoAlign ? (
        <Accordion title="Assistant" open={open.cleanup} onToggle={() => toggle('cleanup')}>
          <p className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
            Snap every element on this tab to the canvas grid so near-aligned shapes line up exactly
            and minor dimension drift collapses. Undoable.
          </p>
          <div className="mt-1 flex items-stretch gap-1.5">
            <Tooltip
              title="Auto align"
              description="Snap positions and sizes to the canvas grid."
              block
            >
              <button
                type="button"
                onClick={tab.onAutoAlign}
                disabled={!tab.canAutoAlign}
                className={
                  tab.canAutoAlign
                    ? 'inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-medium text-slate-700 transition hover:border-brand-300 hover:bg-brand-50/40 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15 dark:hover:text-brand-200'
                    : 'inline-flex w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-medium text-slate-400 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-500'
                }
              >
                <AutoAlignIcon />
                Auto align
              </button>
            </Tooltip>
          </div>
        </Accordion>
      ) : null}
    </div>
  );
}
