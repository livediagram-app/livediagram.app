import { useEffect, useState } from 'react';
import { MOBILE_BREAKPOINT_PX, isMobileViewportSync } from '@/lib/responsive';
import { IconButton, PaletteTintProvider, type PaletteTint } from './palette-controls';
import type { ShapeKind } from '@livediagram/diagram';
import type { PendingDraw } from '@/lib/draw-mode';
import { MovablePanel } from './MovablePanel';
import { PaletteTabBar } from './PaletteTabBar';
import { PaletteDropdown } from './PaletteDropdown';
import {
  EraserIcon,
  IsometricIcon,
  LaserIcon,
  PanIcon,
  SelectIcon,
  SpotlightIcon,
} from './palette-icons';
import { Tooltip } from './Tooltip';
import { ICON_CATALOG, ICON_CATEGORIES, ICON_DND_MIME, iconsInCategory } from '@/lib/icons';
import {
  searchTechIcons,
  TECH_ICON_DND_MIME,
  TECH_PROVIDERS,
  type TechProvider,
} from '@/lib/tech-icons';
import { IconPrims } from './icon-glyph';
import { TechIconArt } from './tech-icon-glyph';

export type CanvasTool = 'pan' | 'select' | 'laser' | 'spotlight' | 'eraser' | 'isometric';

type CommandPaletteProps = {
  position: { x: number; y: number } | null;
  canvasTool: CanvasTool;
  onSetCanvasTool: (tool: CanvasTool) => void;
  onMoveTo: (x: number, y: number) => void;
  onReset: () => void;
  // Desktop panel-layout toggle (normal floating panels <-> minimal compact
  // dock), rendered in the palette header left of the reset button. Omit to
  // hide it (e.g. view-role). The Settings dialog carries the same switch as
  // the always-available way back out of minimal mode.
  minimalPanels?: boolean;
  onToggleMinimalPanels?: () => void;
  onAddShape: (kind: ShapeKind) => void;
  // Drops a curated icon glyph (shape kind 'icon') carrying the chosen
  // catalogue id at the viewport centre. Picked from the Icons
  // accordion's searchable grid.
  onAddIcon: (iconId: string) => void;
  // Drops a Technology (brand) icon (spec/41) as a STANDALONE 'icon'
  // element carrying the chosen tech-catalogue id. Picked from the
  // Technology tab's searchable grid; never dropped inside a shape.
  onAddTechIcon: (iconId: string) => void;
  onAddText: () => void;
  onAddSticky: () => void;
  // Drop a 3x3 editable table at the viewport centre.
  onAddTable: () => void;
  // Drop a note marker (annotation) at the viewport centre. See spec/38.
  onAddAnnotation: () => void;
  // Drop a link-card / bookmark at the viewport centre. See spec/40.
  onAddLinkCard: () => void;
  // Composite "Components" (spec/09): each arms the tap-or-drag draw gesture.
  // Banner / Callout / Stat row / Process need no image and always show; Hero
  // / Header (and the Tools-tab Avatar) carry an image, so they're gated on
  // image upload being available (onAddImage present).
  onAddBanner: () => void;
  onAddHero: () => void;
  onAddHeader: () => void;
  onAddCallout: () => void;
  onAddStatRow: () => void;
  onAddProcess: () => void;
  onAddAvatar: () => void;
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
  pendingDraw?: PendingDraw | null;
  // Optional callback fired with the palette's current bounding box
  // whenever it changes (via MovablePanel's ResizeObserver). Canvas
  // wires this up so the Comments + AI panels can stack below the
  // palette as it changes height.
  onSize?: (size: { width: number; height: number; bottomY: number }) => void;
  // Mobile-only top override (the palette banner sits below the
  // Explorer banner so signed-out users can switch diagrams without
  // leaving the canvas). See MovablePanel for semantics.
  mobileTopOverridePx?: number;
  // Mobile dock control — forwarded to the inner MovablePanel.
  mobileOpenOverride?: boolean;
  onMobileClose?: () => void;
  // Fired when a draw-to-place tool (shape / text / sticky / arrow /
  // freehand) is armed FROM the palette in dock mode, so the parent can
  // reopen the palette once the draw finishes.
  onDrawArmed?: () => void;
  mobileDockAnchor?: { left: number; top: number; arrowOffset: number };
  forceDockMode?: boolean;
  // Active tab theme's element colours, so the palette tiles preview the
  // theme: shape / device / annotation tiles render filled in the theme's
  // fill + stroke, line-art tools + icons tint to the stroke. Undefined (the
  // Basic theme) leaves the palette in its default slate look. See spec/09.
  themeTint?: PaletteTint;
};

export function CommandPalette({
  position,
  canvasTool,
  onSetCanvasTool,
  onMoveTo,
  onReset,
  minimalPanels,
  onToggleMinimalPanels,
  onAddShape,
  onAddIcon,
  onAddTechIcon,
  onAddText,
  onAddSticky,
  onAddTable,
  onAddAnnotation,
  onAddLinkCard,
  onAddBanner,
  onAddHero,
  onAddHeader,
  onAddCallout,
  onAddStatRow,
  onAddProcess,
  onAddAvatar,
  onAddImage,
  onAddArrow,
  onBeginFreehand,
  pendingDraw,
  onSize,
  mobileTopOverridePx,
  mobileOpenOverride,
  onMobileClose,
  onDrawArmed,
  mobileDockAnchor,
  forceDockMode,
  themeTint,
}: CommandPaletteProps) {
  const pendingShapeKind = pendingDraw && pendingDraw.type === 'shape' ? pendingDraw.kind : null;
  // Spotlight (spec/09) is desktop-only: it relies on hover-tracking the
  // cursor and on left/right-click to resize the light, none of which map to
  // touch — so drop it from the tool picker on mobile viewports. Reactive
  // (mirrors MovablePanel) so the option appears / disappears as the viewport
  // crosses the breakpoint, with a sync initial read to avoid a flicker.
  const [isMobile, setIsMobile] = useState(isMobileViewportSync);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia?.(`(max-width: ${MOBILE_BREAKPOINT_PX - 1}px)`);
    if (!mq) return;
    const onChange = () => setIsMobile(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  // If the viewport shrinks into mobile while Spotlight is active (desktop ->
  // resize / rotate), revert to Select: the option has just left the picker,
  // so leaving the tool on spotlight would strand it (the trigger would
  // mislabel as Select while the canvas stayed shrouded).
  useEffect(() => {
    if (isMobile && canvasTool === 'spotlight') onSetCanvasTool('select');
  }, [isMobile, canvasTool, onSetCanvasTool]);
  // On mobile (dock popover mode) close the palette after adding a
  // shape/tool so the user can draw immediately without dismissing manually.
  // Draw-to-place tools also signal onDrawArmed so the parent can reopen the
  // palette once the draw lands; immediate drops (icon/table/...) don't.
  const addShape = (kind: import('@livediagram/diagram').ShapeKind) => {
    onAddShape(kind);
    onDrawArmed?.();
    onMobileClose?.();
  };
  const addIcon = (iconId: string) => {
    onAddIcon(iconId);
    onMobileClose?.();
  };
  const addTechIcon = (iconId: string) => {
    onAddTechIcon(iconId);
    onMobileClose?.();
  };
  const addText = () => {
    onAddText();
    onDrawArmed?.();
    onMobileClose?.();
  };
  const addSticky = () => {
    onAddSticky();
    onDrawArmed?.();
    onMobileClose?.();
  };
  const addTable = () => {
    onAddTable();
    onMobileClose?.();
  };
  const addAnnotation = () => {
    onAddAnnotation();
    onMobileClose?.();
  };
  const addLinkCard = () => {
    onAddLinkCard();
    onMobileClose?.();
  };
  // Components arm the draw gesture (tap-or-drag), so they signal onDrawArmed
  // like shapes do (so the mobile palette reopens once the draw lands) and
  // close the mobile dock so the canvas is clear to draw on.
  const addBanner = () => {
    onAddBanner();
    onDrawArmed?.();
    onMobileClose?.();
  };
  const addHero = () => {
    onAddHero();
    onDrawArmed?.();
    onMobileClose?.();
  };
  const addHeader = () => {
    onAddHeader();
    onDrawArmed?.();
    onMobileClose?.();
  };
  const addCallout = () => {
    onAddCallout();
    onDrawArmed?.();
    onMobileClose?.();
  };
  const addStatRow = () => {
    onAddStatRow();
    onDrawArmed?.();
    onMobileClose?.();
  };
  const addProcess = () => {
    onAddProcess();
    onDrawArmed?.();
    onMobileClose?.();
  };
  const addAvatar = () => {
    onAddAvatar();
    onDrawArmed?.();
    onMobileClose?.();
  };
  const addArrow = () => {
    onAddArrow();
    onDrawArmed?.();
    onMobileClose?.();
  };
  const beginFreehand = () => {
    onBeginFreehand();
    onDrawArmed?.();
    onMobileClose?.();
  };
  const addImage = () => {
    onAddImage?.();
    onMobileClose?.();
  };
  // Per-element + tab formatting now lives in the right-click context
  // menus (element / canvas / tab) and the Tab Appearance modal, not in a
  // side panel. The palette now hosts the canvas-tool toggle row at the
  // top, then a single category tab
  // bar: Shapes (open by default — the most common entry point on
  // every fresh canvas), Tools, Devices, Icons (with more categories
  // to come). Clicking a tab expands its panel; clicking it again
  // collapses; clicking another switches. PaletteTabBar owns the
  // active-tab state, so the palette stays compact no matter how many
  // categories we add.
  // Icon-picker search query (Icons tab). Filters the catalogue
  // by label / keyword as the user types.
  const [iconQuery, setIconQuery] = useState('');
  // Category filter ('all' = no narrowing). Combines with the search box:
  // search runs WITHIN the selected category. Picked from a dropdown beside
  // the search box (replacing the old chip row).
  const [iconCategory, setIconCategory] = useState<string>('all');
  const iconFilters = [{ id: 'all', label: 'All' }, ...ICON_CATEGORIES];
  const iconResults = (
    iconCategory === 'all' ? ICON_CATALOG : iconsInCategory(iconCategory)
  ).filter((i) => {
    const q = iconQuery.trim().toLowerCase();
    if (!q) return true;
    return i.label.toLowerCase().includes(q) || i.keywords.includes(q) || i.id.includes(q);
  });
  // Technology tab (spec/41): full-colour brand icons. Mirrors the Icons
  // tab — a search box plus a provider filter ('all' = no narrowing) over a
  // grid of coloured thumbnails.
  const [techQuery, setTechQuery] = useState('');
  const [techProvider, setTechProvider] = useState<TechProvider | 'all'>('all');
  const techFilters = [{ id: 'all', label: 'All' }, ...TECH_PROVIDERS];
  const techResults = searchTechIcons(techQuery, techProvider);
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
      flushTop
      onReset={onReset}
      onMoveTo={onMoveTo}
      headerExtra={
        onToggleMinimalPanels ? (
          // Desktop panel-layout toggle, sat just left of the reset button.
          // Hidden on mobile (minimal layout is forced there, so the toggle
          // is moot). The Settings dialog mirrors it as the way back out.
          <span className="hidden sm:contents">
            <Tooltip
              title={minimalPanels ? 'Normal panels' : 'Minimal panels'}
              description={
                minimalPanels
                  ? 'Switch back to the floating Palette / Explorer panels.'
                  : 'Collapse the panels into a compact button bar.'
              }
            >
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={onToggleMinimalPanels}
                aria-label={minimalPanels ? 'Use normal panel layout' : 'Use minimal panel layout'}
                aria-pressed={!!minimalPanels}
                className={`flex h-5 w-5 items-center justify-center rounded transition ${
                  minimalPanels
                    ? 'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-200'
                    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-slate-100'
                }`}
              >
                <PanelLayoutIcon />
              </button>
            </Tooltip>
          </span>
        ) : null
      }
      collapsible
      // The category / canvas-tool dropdowns portal their menus to
      // <body>, so a mobile tap on a menu option lands outside the panel
      // DOM; without this it would trip the outside-tap auto-collapse and
      // shut the palette mid-selection.
      outsideExceptSelector="[data-palette-dropdown-menu]"
    >
      {/* Header band: canvas-tool picker (Select / Hand / Laser) on the
          left, category picker on the right. The tool dropdown is a mode
          switch, not an element-add control, so it stays a permanent
          fixture; Select is the default and Space pans regardless of the
          active tool, mirroring Figma. Shapes is the default category
          (the most common entry point on every fresh canvas). */}
      <PaletteTintProvider tint={themeTint}>
        <PaletteTabBar
          defaultOpenId="shapes"
          storageKey="livediagram:palette-category"
          leading={
            <PaletteDropdown
              ariaLabel="Canvas tool"
              value={canvasTool}
              variant="flush"
              onChange={(id) => onSetCanvasTool(id as CanvasTool)}
              options={[
                { id: 'select', label: 'Select', shortcut: 'S', icon: <SelectIcon /> },
                { id: 'pan', label: 'Hand', shortcut: 'P', icon: <PanIcon /> },
                {
                  id: 'isometric',
                  label: 'Isometric',
                  shortcut: 'I',
                  icon: <IsometricIcon />,
                },
                { id: 'laser', label: 'Laser', shortcut: 'L', icon: <LaserIcon /> },
                // Spotlight is desktop-only (hover + click-to-resize don't map
                // to touch); omitted on mobile viewports.
                ...(isMobile
                  ? []
                  : [{ id: 'spotlight', label: 'Spotlight', icon: <SpotlightIcon /> }]),
                { id: 'eraser', label: 'Eraser', shortcut: 'E', icon: <EraserIcon /> },
              ]}
            />
          }
          tabs={[
            {
              id: 'shapes',
              label: 'Shapes',
              description: 'Square, circle, diamond, and the flowchart shape vocabulary.',
              icon: (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  {/* Three distinct shapes (triangle + circle + square)
                    in a little cluster: the universal "shapes" symbol,
                    readable at a glance. */}
                  <path d="M9 2 12.3 7.4 5.7 7.4Z" />
                  <circle cx="5.2" cy="12.8" r="2.8" />
                  <rect x="10.4" y="10" width="5.6" height="5.6" rx="0.9" />
                </svg>
              ),
              content: (
                // Six-column grid (matching the Icons catalogue) so the fixed
                // 36px tiles pack into even, full rows. flex-wrap left a few px
                // short of a sixth tile, so the last shape dropped to its own
                // row with dead space on the right; the grid divides the width
                // into six equal cells and centres each tile. overflow-x-hidden
                // absorbs the few-px slack when six fixed tiles slightly exceed
                // the cell width, exactly as the Icons grid does.
                <div className="grid grid-cols-3 justify-items-center gap-1 overflow-x-hidden">
                  <IconButton
                    label="Add square"
                    description="Drop a new square shape on the canvas."
                    onClick={() => addShape('square')}
                    dragKind="square"
                    filled
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
                    dragKind="circle"
                    filled
                    active={pendingShapeKind === 'circle'}
                    shortcut="O"
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                      <circle
                        cx="9"
                        cy="9"
                        r="6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </svg>
                  </IconButton>
                  <IconButton
                    label="Add diamond"
                    description="Diamond. Decision node."
                    onClick={() => addShape('diamond')}
                    dragKind="diamond"
                    filled
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
                    dragKind="cylinder"
                    filled
                    active={pendingShapeKind === 'cylinder'}
                    shortcut="C"
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
                    dragKind="parallelogram"
                    filled
                    active={pendingShapeKind === 'parallelogram'}
                    shortcut="G"
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
                    dragKind="hexagon"
                    filled
                    active={pendingShapeKind === 'hexagon'}
                    shortcut="H"
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
                    dragKind="document"
                    filled
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
                    dragKind="stadium"
                    filled
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
                    dragKind="cloud"
                    filled
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
                  <IconButton
                    label="Add triangle"
                    description="Triangle. A basic shape."
                    onClick={() => addShape('triangle')}
                    dragKind="triangle"
                    filled
                    active={pendingShapeKind === 'triangle'}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                      <polygon
                        points="9,3 16,15 2,15"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </IconButton>
                  <IconButton
                    label="Add trapezoid"
                    description="Trapezoid. Flowchart manual operation."
                    onClick={() => addShape('trapezoid')}
                    dragKind="trapezoid"
                    filled
                    active={pendingShapeKind === 'trapezoid'}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                      <polygon
                        points="5,4 13,4 16,15 2,15"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </IconButton>
                  <IconButton
                    label="Add star"
                    description="Star. Highlight or rating."
                    onClick={() => addShape('star')}
                    dragKind="star"
                    filled
                    active={pendingShapeKind === 'star'}
                  >
                    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
                      <polygon
                        points="9,1.5 10.8,6.6 16.1,6.7 11.9,9.9 13.4,15.1 9,12 4.6,15.1 6.1,9.9 1.9,6.7 7.2,6.6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.6"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </IconButton>
                  <IconButton
                    label="Add speech bubble"
                    caption="Bubble"
                    description="Speech bubble. A callout with a tail."
                    onClick={() => addShape('speech-bubble')}
                    dragKind="speech-bubble"
                    filled
                    active={pendingShapeKind === 'speech-bubble'}
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
                      <path d="M4 3 H14 a2 2 0 0 1 2 2 V10 a2 2 0 0 1 -2 2 H7 L4.5 15.5 L5.5 12 H4 a2 2 0 0 1 -2 -2 V5 a2 2 0 0 1 2 -2 Z" />
                    </svg>
                  </IconButton>
                </div>
              ),
            },
            {
              id: 'tools',
              label: 'Tools',
              description:
                'Text, pencil, arrow, sticky note, table, image, user, frame, and annotation.',
              icon: (
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
                  {/* Lucide-style wrench: a clean, instantly-readable
                    "tools" glyph. */}
                  <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
                </svg>
              ),
              content: (
                // Six-column grid (matching the Shapes + Icons tabs) so the
                // fixed tiles wrap into even rows. A single-row flex used to
                // overflow the palette width and silently clip the last
                // buttons (user / frame / annotation) off the right edge.
                <div className="grid grid-cols-3 justify-items-center gap-1 overflow-x-hidden">
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
                    caption="Note"
                    description="Sticky note for short annotations."
                    onClick={addSticky}
                    noTint
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
                      noTint
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
                  {onAddImage ? (
                    <IconButton
                      label="Add avatar"
                      description="Avatar. A circular image. Tap to drop or drag to size; double-click it to pick / upload a photo."
                      onClick={addAvatar}
                      active={pendingDraw?.type === 'component' && pendingDraw.kind === 'avatar'}
                      noTint
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <circle cx="12" cy="12" r="9" />
                        <circle cx="12" cy="9.5" r="3" />
                        <path d="M6.5 19a6 6 0 0 1 11 0" />
                      </svg>
                    </IconButton>
                  ) : null}
                  <IconButton
                    label="Add user"
                    description="User / actor. Use-case and architecture diagrams."
                    onClick={() => addShape('actor')}
                    dragKind="actor"
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
                  <IconButton
                    label="Add frame"
                    description="Frame. A titled container you draw around a cluster of elements."
                    onClick={() => addShape('frame')}
                    dragKind="frame"
                    active={pendingShapeKind === 'frame'}
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 18 18"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <rect x="2.5" y="4" width="13" height="10.5" />
                      <path d="M2.5 6.8 H8.5" />
                    </svg>
                  </IconButton>
                  <IconButton
                    label="Add annotation"
                    description="Annotation. A note marker: hover to read it, click to edit."
                    onClick={addAnnotation}
                    filled
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M4 5.5h16A1.5 1.5 0 0 1 21.5 7v8a1.5 1.5 0 0 1-1.5 1.5H10l-4 3v-3H4A1.5 1.5 0 0 1 2.5 15V7A1.5 1.5 0 0 1 4 5.5Z" />
                      <path d="M6.5 9.75h11" />
                      <path d="M6.5 12.5h7" />
                    </svg>
                  </IconButton>
                  <IconButton
                    label="Add link card"
                    description="Link card. A bookmark preview with the page's title, favicon, and image."
                    onClick={addLinkCard}
                    noTint
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1.5 1.5" />
                      <path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1.5-1.5" />
                    </svg>
                  </IconButton>
                </div>
              ),
            },
            {
              id: 'components',
              label: 'Components',
              description:
                'Ready-made composites that follow the tab theme: Banner, Hero, and Header. Each drops as a group you can recolour, retitle, or ungroup.',
              icon: (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  {/* Stacked blocks — a header bar over a content block — reading
                      as "pre-assembled section". */}
                  <rect x="2.5" y="2.5" width="13" height="4" rx="1" />
                  <rect x="2.5" y="8" width="13" height="7.5" rx="1" />
                </svg>
              ),
              content: (
                <div className="grid grid-cols-3 gap-1 px-2 pb-1.5">
                  <IconButton
                    label="Add banner"
                    description="Banner. A themed title block (accent bar with a title and subtitle) to head your diagram. Tap to drop or drag to size; drops as a group you can recolour, retitle, or ungroup."
                    onClick={addBanner}
                    active={pendingDraw?.type === 'component' && pendingDraw.kind === 'banner'}
                    noTint
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
                      <path d="M7 10.75h10" strokeWidth="2.2" />
                      <path d="M9 14.25h6" />
                    </svg>
                  </IconButton>
                  <IconButton
                    label="Add callout"
                    description="Callout. A soft note box with an icon, title, and body for annotating a diagram. Tap to drop or drag to size."
                    onClick={addCallout}
                    active={pendingDraw?.type === 'component' && pendingDraw.kind === 'callout'}
                    noTint
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <rect x="2.5" y="4.5" width="19" height="15" rx="2" />
                      <circle cx="7" cy="9" r="2" fill="currentColor" stroke="none" />
                      <path d="M11 8.5h8M6 13h13M6 16h9" />
                    </svg>
                  </IconButton>
                  <IconButton
                    label="Add stat row"
                    description="Stat row. Three KPI cards (big number + caption) for dashboards / summaries. Tap to drop or drag to size."
                    onClick={addStatRow}
                    active={pendingDraw?.type === 'component' && pendingDraw.kind === 'stat'}
                    noTint
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <rect x="2" y="6" width="6" height="12" rx="1" />
                      <rect x="9" y="6" width="6" height="12" rx="1" />
                      <rect x="16" y="6" width="6" height="12" rx="1" />
                      <path d="M3.5 10.5h3M10.5 10.5h3M17.5 10.5h3" />
                    </svg>
                  </IconButton>
                  <IconButton
                    label="Add process steps"
                    description="Process steps. Numbered circles joined by arrows with captions, for flows. Tap to drop or drag to size."
                    onClick={addProcess}
                    active={pendingDraw?.type === 'component' && pendingDraw.kind === 'process'}
                    noTint
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <circle cx="5" cy="12" r="3" />
                      <circle cx="12" cy="12" r="3" />
                      <circle cx="19" cy="12" r="3" />
                      <path d="M8 12h1M15 12h1" />
                    </svg>
                  </IconButton>
                  {onAddImage ? (
                    <IconButton
                      label="Add hero"
                      description="Hero. A large image with a title and supporting line on a themed caption card. Tap to drop or drag to size; double-click the image to set it."
                      onClick={addHero}
                      active={pendingDraw?.type === 'component' && pendingDraw.kind === 'hero'}
                      noTint
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <rect x="2.5" y="3.5" width="19" height="17" rx="2" />
                        <path d="M2.5 14l5-4 4 3 3-2.5 7 5.5" />
                        <path d="M7 17.5h10" strokeWidth="2.2" />
                      </svg>
                    </IconButton>
                  ) : null}
                  {onAddImage ? (
                    <IconButton
                      label="Add header"
                      description="Header. A website-style bar with a circular avatar, brand title, and nav links. Tap to drop or drag to size; double-click the avatar to set it."
                      onClick={addHeader}
                      active={pendingDraw?.type === 'component' && pendingDraw.kind === 'header'}
                      noTint
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <rect x="2.5" y="6.5" width="19" height="11" rx="2" />
                        <circle cx="7" cy="12" r="2.2" />
                        <path d="M14 10.5h5M14 13.5h5" />
                      </svg>
                    </IconButton>
                  ) : null}
                </div>
              ),
            },
            {
              id: 'devices',
              label: 'Devices',
              description:
                'Wireframing device frames: browser, monitor, laptop, phone, tablet, smartwatch.',
              icon: (
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 18 18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                >
                  <rect x="2.5" y="3" width="13" height="9" rx="1" />
                  <path d="M6.5 15h5M9 12v3" />
                </svg>
              ),
              content: (
                <>
                  {/* Wireframing primitives. Each renders as the device's
            silhouette so the user can drop it as a container and
            arrange interface elements inside. See spec/09 "Devices".
            Six-column grid (like Icons / Shapes) so all six device tiles
            sit on one full row instead of flex-wrap pushing the smartwatch
            onto its own line with a gap on the right. */}
                  <div className="grid grid-cols-3 justify-items-center gap-1 overflow-x-hidden">
                    <IconButton
                      label="Add web browser"
                      caption="Browser"
                      description="Browser window. Wireframe a web page or a web-app screen."
                      onClick={() => addShape('browser')}
                      dragKind="browser"
                      filled
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
                      caption="Monitor"
                      description="Desktop monitor with stand. Wireframe a desktop app."
                      onClick={() => addShape('monitor')}
                      dragKind="monitor"
                      filled
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
                      dragKind="laptop"
                      filled
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
                      dragKind="phone"
                      filled
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
                      dragKind="tablet"
                      filled
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
                    <IconButton
                      label="Add smartwatch"
                      caption="Watch"
                      description="Smartwatch. A wrist-device frame for watch-app wireframes."
                      onClick={() => addShape('smartwatch')}
                      dragKind="smartwatch"
                      filled
                      active={pendingShapeKind === 'smartwatch'}
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
                        <rect x="5.5" y="4" width="7" height="10" rx="2.2" />
                        <path d="M7 4 V1.8 M11 4 V1.8 M7 14 V16.2 M11 14 V16.2 M12.5 8 H14" />
                      </svg>
                    </IconButton>
                  </div>
                </>
              ),
            },
            {
              id: 'icons',
              label: 'Icons',
              description: 'Searchable catalogue of single-colour glyphs.',
              icon: (
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
                  {/* A smiley glyph reads as "pick an icon" more clearly
                    than a star (which implies favourites). */}
                  <circle cx="12" cy="12" r="9.5" />
                  <path d="M8.4 14.5s1.4 1.9 3.6 1.9 3.6-1.9 3.6-1.9" />
                  <path d="M9 9.5h.01" />
                  <path d="M15 9.5h.01" />
                </svg>
              ),
              content: (
                <>
                  {/* Searchable catalogue of single-colour glyphs. Clicking one
            drops it at the viewport centre as an 'icon' shape tinted
            by the element's stroke colour. See spec/09 "Icons". */}
                  {/* Filter dropdown sits LEFT of the search (flex-row-reverse) so
                    it doesn't stack under the category picker at the top-right. */}
                  <div className="relative mb-2 flex flex-row-reverse items-center gap-1.5">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={iconQuery}
                        onChange={(e) => setIconQuery(e.target.value)}
                        placeholder="Search icons"
                        aria-label="Search icons"
                        className="w-full rounded-md border border-slate-200 bg-white py-1 pl-2 pr-7 text-xs text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      />
                      {iconQuery ? (
                        <Tooltip title="Clear search" description="Clear the icon search query.">
                          <button
                            type="button"
                            onClick={() => setIconQuery('')}
                            aria-label="Clear icon search"
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
                        </Tooltip>
                      ) : null}
                    </div>
                    {/* Category filter dropdown (replaces the chip row): pick one
                      category to narrow the grid; "All" clears it. */}
                    <div className="shrink-0">
                      <PaletteDropdown
                        ariaLabel="Filter icons by category"
                        value={iconCategory}
                        onChange={setIconCategory}
                        align="left"
                        accent={iconCategory !== 'all'}
                        options={iconFilters}
                        triggerLeading={
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
                            className="shrink-0"
                          >
                            <path d="M2 4h12M4.5 8h7M7 12h2" />
                          </svg>
                        }
                      />
                    </div>
                  </div>
                  {/* overflow-x-hidden: a vertical scrollbar narrows the row
                    enough that six fixed-width tiles overflow by a few px,
                    and `overflow-y-auto` would otherwise also surface a
                    horizontal scrollbar (CSS resolves the other axis to
                    auto). justify-items-center keeps the slack symmetric so
                    nothing visible clips. */}
                  <div className="grid max-h-72 grid-cols-5 justify-items-center gap-1 overflow-y-auto overflow-x-hidden">
                    {iconResults.map((icon) => (
                      <IconButton
                        key={icon.id}
                        label={`Add ${icon.label}`}
                        description={`Click to add, or drag onto a shape to set its icon.`}
                        hideTooltip
                        hideCaption
                        onClick={() => addIcon(icon.id)}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(ICON_DND_MIME, icon.id);
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
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
                </>
              ),
            },
            {
              id: 'technology',
              label: 'Technology',
              description:
                'Full-colour AWS, Azure, and generic-infrastructure icons for system-architecture diagrams.',
              icon: (
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
                  {/* Stacked servers / racks: the universal "infrastructure"
                    mark, distinct from the smiley used for line-art icons. */}
                  <rect x="3" y="4" width="18" height="7" rx="1.5" />
                  <rect x="3" y="13" width="18" height="7" rx="1.5" />
                  <path d="M7 7.5h.01M7 16.5h.01" />
                </svg>
              ),
              content: (
                <>
                  {/* Searchable catalogue of brand icons. Clicking one drops it
                    at the viewport centre as a standalone 'icon' shape with
                    fixed brand colours; dragging drops it at the pointer. See
                    spec/41. */}
                  {/* Filter dropdown sits LEFT of the search (flex-row-reverse) so
                    it doesn't stack under the category picker at the top-right. */}
                  <div className="relative mb-2 flex flex-row-reverse items-center gap-1.5">
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={techQuery}
                        onChange={(e) => setTechQuery(e.target.value)}
                        placeholder="Search technology"
                        aria-label="Search technology icons"
                        className="w-full rounded-md border border-slate-200 bg-white py-1 pl-2 pr-7 text-xs text-slate-700 placeholder:text-slate-400 focus:border-brand-400 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                      />
                      {techQuery ? (
                        <Tooltip
                          title="Clear search"
                          description="Clear the technology search query."
                        >
                          <button
                            type="button"
                            onClick={() => setTechQuery('')}
                            aria-label="Clear technology search"
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
                        </Tooltip>
                      ) : null}
                    </div>
                    {/* Provider filter: narrow to AWS / Azure / Generic; "All"
                      clears it. Combines with the search box. */}
                    <div className="shrink-0">
                      <PaletteDropdown
                        ariaLabel="Filter technology icons by provider"
                        value={techProvider}
                        onChange={(id) => setTechProvider(id as TechProvider | 'all')}
                        align="left"
                        accent={techProvider !== 'all'}
                        options={techFilters}
                        triggerLeading={
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
                            className="shrink-0"
                          >
                            <path d="M2 4h12M4.5 8h7M7 12h2" />
                          </svg>
                        }
                      />
                    </div>
                  </div>
                  {/* Three per row (two fewer than the line-art Icons grid) so
                    each tile is big enough to read the brand glyph + caption —
                    the brand glyphs aren't self-explanatory the way a labelled
                    line icon's shape is, so the name sits beneath each one. */}
                  <div className="grid max-h-72 grid-cols-3 justify-items-stretch gap-1 overflow-y-auto overflow-x-hidden">
                    {techResults.map((icon) => (
                      <IconButton
                        key={icon.id}
                        label={`Add ${icon.label}`}
                        caption={icon.short ?? icon.label}
                        description="Click to add, or drag onto the canvas."
                        hideTooltip
                        onClick={() => addTechIcon(icon.id)}
                        noTint
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData(TECH_ICON_DND_MIME, icon.id);
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                      >
                        <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
                          <TechIconArt iconId={icon.id} />
                        </svg>
                      </IconButton>
                    ))}
                    {techResults.length === 0 ? (
                      <p className="col-span-4 px-1 py-2 text-center text-[11px] text-slate-400">
                        No technology icons match “{techQuery}”.
                      </p>
                    ) : null}
                  </div>
                </>
              ),
            },
          ]}
        />
      </PaletteTintProvider>
    </MovablePanel>
  );
}

// Panel-layout glyph (a panel split into a sidebar + body) for the header
// minimal-panels toggle. Moved here from TabBar when the toggle relocated
// into the palette header.
function PanelLayoutIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="3" y="4" width="14" height="12" rx="1.5" />
      <path d="M8 4v12" />
    </svg>
  );
}
