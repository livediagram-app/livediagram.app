import { useState } from 'react';
import { Accordion, IconButton, ToolButton } from './palette-controls';
export {
  SelectedElementSection,
  ALL_SELECTED_ACCORDIONS_CLOSED,
  type SelectedAccordionState,
} from './SelectedElementSection';
export { TabSection, type TabAccordionState } from './TabSection';
import type {
  ArrowEnds,
  ArrowheadShape,
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
import { type ThemeId } from '@/lib/themes';
import { MovablePanel } from './MovablePanel';
import { LaserIcon, PanIcon, SelectIcon, ZenIcon } from './palette-icons';
import { Tooltip } from './Tooltip';
import { searchIcons } from '@/lib/icons';
import { IconPrims } from './icon-glyph';

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
  // Font (spec/28): the element's font id, `null` when it uses the tab
  // default / has no text. `onSetFont(null)` clears the override so the
  // element falls back to the tab's font.
  font: string | null;
  onSetFont: (font: string | null) => void;
  // Whether the selected element currently has non-empty label text.
  // The Text accordion is hidden entirely when false: size / style /
  // alignment / padding only matter once the element has a label, and
  // you add one by double-clicking the element, not from this panel.
  hasText: boolean;
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
  // Arrowhead head shape (filled / hollow triangle, open V, dot,
  // diamond...). Null unless an arrow with at least one head is
  // selected. Pairs with the UML-style connectors.
  arrowheadShape: ArrowheadShape | null;
  onSetArrowheadShape: (shape: ArrowheadShape) => void;
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
  // Non-null only when a table is selected. Drive the Table
  // accordion's header-row / header-column toggles (combinable).
  tableHeaderRow: boolean | null;
  tableHeaderColumn: boolean | null;
  tableZebra: boolean | null;
  onToggleTableHeaderRow: () => void;
  onToggleTableHeaderColumn: () => void;
  onToggleTableZebra: () => void;
  // Header-band colours for a selected table (effective colour
  // shown in the swatch; null for non-tables).
  tableHeaderFill: string | null;
  tableHeaderTextColor: string | null;
  onSetTableHeaderFill: (color: string) => void;
  onSetTableHeaderTextColor: (color: string) => void;
};

export type TabSectionControls = {
  backgroundPattern: BackgroundPattern;
  backgroundColor: string;
  patternColor: string;
  themeId: ThemeId;
  // Tab default font id (spec/28), or null for the editor default.
  // `onSetTabFont(null)` clears it.
  font: string | null;
  onSetTabFont: (font: string | null) => void;
  // Tab default text size for NEW palette elements (spec/28). Unset =
  // the per-type factory default; the picker shows 'md' as the baseline.
  defaultTextSize: TextSize | null;
  onSetTabDefaultTextSize: (size: TextSize) => void;
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
  // the Assistant accordion. Hidden when missing.
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
  // Enter zen / focus mode (spec/26). Sits beside the Pan/Select/Laser
  // tools but isn't a CanvasTool — it's an orthogonal chrome-hide flag,
  // so it's a momentary action button, never shown "active" here (the
  // whole palette is hidden once zen is on; exit lives by the zoom dock).
  onToggleZen?: () => void;
  onMoveTo: (x: number, y: number) => void;
  onReset: () => void;
  onAddShape: (kind: ShapeKind) => void;
  // Drops a curated icon glyph (shape kind 'icon') carrying the chosen
  // catalogue id at the viewport centre. Picked from the Icons
  // accordion's searchable grid.
  onAddIcon: (iconId: string) => void;
  onAddText: () => void;
  onAddSticky: () => void;
  // Drop a 3x3 editable table at the viewport centre.
  onAddTable: () => void;
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
  // Mobile dock control — forwarded to the inner MovablePanel.
  mobileOpenOverride?: boolean;
  onMobileClose?: () => void;
  mobileDockAnchor?: { left: number; top: number; arrowOffset: number };
  forceDockMode?: boolean;
};

export function CommandPalette({
  position,
  canvasTool,
  onSetCanvasTool,
  onToggleZen,
  onMoveTo,
  onReset,
  onAddShape,
  onAddIcon,
  onAddText,
  onAddSticky,
  onAddTable,
  onAddImage,
  onAddArrow,
  onBeginFreehand,
  pendingDraw,
  onSize,
  mobileTopOverridePx,
  mobileOpenOverride,
  onMobileClose,
  mobileDockAnchor,
  forceDockMode,
}: CommandPaletteProps) {
  const pendingShapeKind = pendingDraw && pendingDraw.type === 'shape' ? pendingDraw.kind : null;
  // On mobile (dock popover mode) close the palette after adding a
  // shape/tool so the user can draw immediately without dismissing manually.
  const addShape = (kind: import('@livediagram/diagram').ShapeKind) => {
    onAddShape(kind);
    onMobileClose?.();
  };
  const addIcon = (iconId: string) => {
    onAddIcon(iconId);
    onMobileClose?.();
  };
  const addText = () => {
    onAddText();
    onMobileClose?.();
  };
  const addSticky = () => {
    onAddSticky();
    onMobileClose?.();
  };
  const addTable = () => {
    onAddTable();
    onMobileClose?.();
  };
  const addArrow = () => {
    onAddArrow();
    onMobileClose?.();
  };
  const beginFreehand = () => {
    onBeginFreehand();
    onMobileClose?.();
  };
  const addImage = () => {
    onAddImage?.();
    onMobileClose?.();
  };
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
    icons: false,
  });
  const togglePalette = (key: 'tools' | 'devices' | 'icons') =>
    setPaletteOpen((prev) => {
      const closed = { tools: false, devices: false, icons: false };
      if (prev[key]) return closed;
      return { ...closed, [key]: true };
    });
  // Icon-picker search query (Icons accordion). Filters the catalogue
  // by label / keyword as the user types.
  const [iconQuery, setIconQuery] = useState('');
  const iconResults = searchIcons(iconQuery);
  return (
    <MovablePanel
      title="Palette"
      position={position}
      defaultCorner="top-right"
      width="w-auto sm:w-64"
      onSize={onSize}
      mobileTopOverridePx={mobileTopOverridePx}
      mobileOpenOverride={mobileOpenOverride}
      onMobileClose={onMobileClose}
      mobileDockAnchor={mobileDockAnchor}
      forceDockMode={forceDockMode}
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
        {onToggleZen ? (
          <Tooltip
            title="Zen mode"
            description="Hide every panel and toolbar to focus on the canvas. Exit from the zoom controls or press Z."
          >
            <ToolButton active={false} label="Zen" onClick={onToggleZen} shortcut="Z">
              <ZenIcon />
            </ToolButton>
          </Tooltip>
        ) : null}
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
            onClick={() => addShape('square')}
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
            onClick={() => addShape('circle')}
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
            onClick={() => addShape('diamond')}
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
            onClick={() => addShape('cylinder')}
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
            onClick={() => addShape('parallelogram')}
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
            onClick={() => addShape('hexagon')}
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
            onClick={() => addShape('document')}
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
            onClick={() => addShape('stadium')}
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
            onClick={() => addShape('cloud')}
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
            onClick={addText}
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
            onClick={beginFreehand}
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
            onClick={addArrow}
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
            onClick={addSticky}
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
          <IconButton
            label="Add table"
            description="Editable grid. Double-click a cell to type."
            onClick={addTable}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              aria-hidden
            >
              <rect x="2.5" y="3.5" width="13" height="11" rx="1" />
              <line x1="2.5" y1="7.5" x2="15.5" y2="7.5" />
              <line x1="2.5" y1="11" x2="15.5" y2="11" />
              <line x1="7" y1="3.5" x2="7" y2="14.5" />
              <line x1="11" y1="3.5" x2="11" y2="14.5" />
            </svg>
          </IconButton>
          {onAddImage ? (
            <IconButton
              label="Add image"
              description="Drop an image placeholder + pick / upload a file."
              onClick={addImage}
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
            onClick={() => addShape('actor')}
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
            onClick={() => addShape('browser')}
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
            onClick={() => addShape('monitor')}
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
            onClick={() => addShape('laptop')}
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
            onClick={() => addShape('phone')}
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
            onClick={() => addShape('tablet')}
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
      <Accordion title="Icons" open={paletteOpen.icons} onToggle={() => togglePalette('icons')}>
        {/* Searchable catalogue of single-colour glyphs. Clicking one
            drops it at the viewport centre as an 'icon' shape tinted
            by the element's stroke colour. See spec/09 "Icons". */}
        <div className="relative mb-2">
          <input
            type="text"
            value={iconQuery}
            onChange={(e) => setIconQuery(e.target.value)}
            placeholder="Search icons"
            aria-label="Search icons"
            className="w-full rounded-md border border-slate-200 bg-white py-1 pl-2 pr-7 text-xs text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          />
          {iconQuery ? (
            <button
              type="button"
              onClick={() => setIconQuery('')}
              aria-label="Clear icon search"
              title="Clear search"
              className="absolute right-1 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
            >
              <svg
                width="12"
                height="12"
                viewBox="0 0 12 12"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                aria-hidden
              >
                <path d="M3 3 L9 9 M9 3 L3 9" />
              </svg>
            </button>
          ) : null}
        </div>
        <div className="grid max-h-44 grid-cols-6 gap-1 overflow-y-auto">
          {iconResults.map((icon) => (
            <IconButton
              key={icon.id}
              label={`Add ${icon.label}`}
              description={`Drop a ${icon.label.toLowerCase()} icon.`}
              onClick={() => addIcon(icon.id)}
            >
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <IconPrims iconId={icon.id} />
              </svg>
            </IconButton>
          ))}
          {iconResults.length === 0 ? (
            <p className="col-span-6 px-1 py-2 text-center text-[11px] text-slate-400">
              No icons match “{iconQuery}”.
            </p>
          ) : null}
        </div>
      </Accordion>
    </MovablePanel>
  );
}
