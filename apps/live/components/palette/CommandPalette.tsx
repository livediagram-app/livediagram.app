import { useEffect, useState } from 'react';
import { MOBILE_BREAKPOINT_PX, isMobileViewportSync } from '@/lib/responsive';
import { IconButton, PaletteTintProvider } from '@/components/palette/palette-controls';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { PaletteSettingsPopover } from '@/components/palette/PaletteSettingsPopover';
import { PaletteTabBar } from '@/components/palette/PaletteTabBar';
import { PaletteDropdown } from '@/components/palette/PaletteDropdown';
import {
  PaletteShapesTab,
  PaletteToolsTab,
  PaletteComponentsTab,
} from '@/components/palette/palette-create-tabs';
import {
  EraserIcon,
  FormatPainterIcon,
  IsometricIcon,
  LaserIcon,
  PanIcon,
  SelectIcon,
  SpotlightIcon,
} from '@/components/palette/palette-icons';
import { Tooltip } from '@/components/primitives/Tooltip';
import { ICON_CATALOG, ICON_CATEGORIES, ICON_DND_MIME, iconsInCategory } from '@/lib/icons';
import {
  searchTechIcons,
  TECH_ICON_DND_MIME,
  TECH_PROVIDERS,
  type TechProvider,
} from '@/lib/tech-icons';
import { IconPrims } from '@/components/primitives/icon-glyph';
import { TechIconArt } from '@/components/primitives/tech-icon-glyph';

import type { CanvasTool, CommandPaletteProps } from './CommandPalette.types';

export type { CanvasTool };

export function CommandPalette({
  position,
  canvasTool,
  onSetCanvasTool,
  onMoveTo,
  onReset,
  minimalPanels,
  onToggleMinimalPanels,
  settings,
  onChangeSettings,
  canvasEmpty,
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
  dock,
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
      growBody
      onMoveTo={onMoveTo}
      {...dock}
      // The settings popover is the palette's only header affordance besides
      // minimise: it now hosts the panel-layout toggle and the reset-position
      // action that each used to be their own header button.
      headerActions={
        <PaletteSettingsPopover
          settings={settings}
          onChange={onChangeSettings}
          minimalPanels={minimalPanels}
          onToggleMinimalPanels={onToggleMinimalPanels}
          onResetPosition={onReset}
          // When docking is active (spec/63) the panel can always be
          // snapped back to its default corner, even sitting in a
          // (non-default) corner where `position` is null.
          resettable={position !== null || dock !== undefined}
        />
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
          // No storageKey: the palette always opens on Shapes when a diagram
          // loads (the most common entry point) rather than restoring the
          // last-used category across diagrams. See spec/09.
          defaultOpenId="shapes"
          leading={
            <PaletteDropdown
              ariaLabel="Canvas tool"
              value={canvasTool}
              variant="flush"
              autoHeight
              onChange={(id) => onSetCanvasTool(id as CanvasTool)}
              // Grouped (group index drives the menu dividers): editing tools
              // (Select / Hand / Eraser), then presenter tools (Laser /
              // Spotlight), then the isometric view on its own.
              options={[
                { id: 'select', label: 'Select', shortcut: 'V', icon: <SelectIcon />, group: 0 },
                { id: 'pan', label: 'Hand', shortcut: 'H', icon: <PanIcon />, group: 0 },
                // Eraser / Format / Laser / Spotlight / Isometric all act on
                // existing content, so they're disabled on an empty canvas —
                // only Select + Hand stay available until something's drawn.
                {
                  id: 'eraser',
                  label: 'Eraser',
                  shortcut: 'E',
                  icon: <EraserIcon />,
                  group: 0,
                  disabled: canvasEmpty,
                },
                // Format painter as a persistent tool: pick a base element,
                // then tap any number of targets to paint its style. No
                // keyboard shortcut (F is the Pencil/freehand key).
                {
                  id: 'format',
                  label: 'Format',
                  icon: <FormatPainterIcon />,
                  group: 0,
                  disabled: canvasEmpty,
                },
                {
                  id: 'laser',
                  label: 'Laser',
                  shortcut: 'K',
                  icon: <LaserIcon />,
                  group: 1,
                  disabled: canvasEmpty,
                },
                // Spotlight is desktop-only (hover + click-to-resize don't map
                // to touch); omitted on mobile viewports.
                ...(isMobile
                  ? []
                  : [
                      {
                        id: 'spotlight',
                        label: 'Spotlight',
                        icon: <SpotlightIcon />,
                        group: 1,
                        disabled: canvasEmpty,
                      },
                    ]),
                {
                  id: 'isometric',
                  label: 'Isometric',
                  shortcut: 'I',
                  icon: <IsometricIcon />,
                  group: 2,
                  disabled: canvasEmpty,
                },
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
              content: <PaletteShapesTab pendingDraw={pendingDraw} addShape={addShape} />,
            },
            {
              id: 'tools',
              label: 'Tools',
              description:
                'Text, pencil, arrow, sticky note, table, image, user, frame, and annotation, plus a Data section of charts (pie, bar, line, progress, rating).',
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
                <PaletteToolsTab
                  pendingDraw={pendingDraw}
                  addShape={addShape}
                  addArrow={addArrow}
                  addAvatar={addAvatar}
                  addImage={addImage}
                  addSticky={addSticky}
                  addTable={addTable}
                  addText={addText}
                  addAnnotation={addAnnotation}
                  addLinkCard={addLinkCard}
                  beginFreehand={beginFreehand}
                  onAddImage={onAddImage}
                />
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
                <PaletteComponentsTab
                  pendingDraw={pendingDraw}
                  addBanner={addBanner}
                  addHero={addHero}
                  addHeader={addHeader}
                  addCallout={addCallout}
                  addStatRow={addStatRow}
                  addProcess={addProcess}
                  onAddImage={onAddImage}
                />
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
