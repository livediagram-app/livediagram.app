import { useEffect, useState } from 'react';
import { MOBILE_BREAKPOINT_PX, isMobileViewportSync } from '@/lib/responsive';
import { PaletteTintProvider } from '@/components/palette/palette-controls';
import { DevicePickerTab } from '@/components/palette/DevicePickerTab';
import { IconPickerTab } from '@/components/palette/IconPickerTab';
import { TechPickerTab } from '@/components/palette/TechPickerTab';
import { MovablePanel } from '@/components/primitives/MovablePanel';
import { PaletteSettingsPopover } from '@/components/palette/PaletteSettingsPopover';
import { PaletteTabBar } from '@/components/palette/PaletteTabBar';
import {
  ComponentsTabIcon,
  DevicesTabIcon,
  IconsTabIcon,
  ShapesTabIcon,
  TechTabIcon,
  ToolsTabIcon,
} from './palette-tab-icons';
import { PaletteDropdown } from '@/components/palette/PaletteDropdown';
import {
  PaletteShapesTab,
  PaletteToolsTab,
  PaletteComponentsTab,
} from '@/components/palette/palette-create-tabs';
import { getIconCatalog, ICON_CATEGORIES, iconsInCategory } from '@/lib/icons';
import { searchTechIcons, TECH_PROVIDERS, type TechProvider } from '@/lib/tech-icons';
import { useIconCatalogs } from '@/hooks/ui/useIconCatalogs';

import type { CanvasTool, CommandPaletteProps } from './CommandPalette.types';
import { buildCanvasToolOptions } from './canvas-tool-options';

export type { CanvasTool };

export function CommandPalette({
  position,
  canvasTool,
  onSetCanvasTool,
  onToggleZen,
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
  // Both icon catalogues load as one async chunk (lib/icon-registry.ts).
  // Subscribing here re-renders the palette when the data lands, so the two
  // result lists below re-derive from the populated catalogue; until then
  // they're empty and the picker tabs show a brief "Loading icons" note
  // (via `iconCatalogsLoaded`) instead of a false "no matches".
  const iconCatalogsLoaded = useIconCatalogs();
  const iconFilters = [{ id: 'all', label: 'All' }, ...ICON_CATEGORIES];
  const iconResults = (
    iconCategory === 'all' ? getIconCatalog() : iconsInCategory(iconCategory)
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
              // 'zen' is an action entry, not a tool: fire the toggle and
              // keep the current tool selected (see canvas-tool-options).
              onChange={(id) => {
                if (id === 'zen') onToggleZen?.();
                else onSetCanvasTool(id as CanvasTool);
              }}
              options={buildCanvasToolOptions({
                canvasEmpty,
                isMobile,
                includeZen: !!onToggleZen,
              })}
            />
          }
          tabs={[
            {
              id: 'shapes',
              label: 'Shapes',
              description: 'Square, circle, diamond, and the flowchart shape vocabulary.',
              icon: <ShapesTabIcon />,
              content: <PaletteShapesTab pendingDraw={pendingDraw} addShape={addShape} />,
            },
            {
              id: 'tools',
              label: 'Tools',
              description:
                'Text, pencil, arrow, sticky note, table, image, user, frame, and annotation, plus a Data section of charts (pie, bar, line, progress, rating).',
              icon: <ToolsTabIcon />,
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
              icon: <ComponentsTabIcon />,
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
              icon: <DevicesTabIcon />,
              content: <DevicePickerTab addShape={addShape} pendingShapeKind={pendingShapeKind} />,
            },
            {
              id: 'icons',
              label: 'Icons',
              description: 'Searchable catalogue of single-colour glyphs.',
              icon: <IconsTabIcon />,
              content: (
                <IconPickerTab
                  addIcon={addIcon}
                  iconQuery={iconQuery}
                  setIconQuery={setIconQuery}
                  iconCategory={iconCategory}
                  setIconCategory={setIconCategory}
                  iconFilters={iconFilters}
                  iconResults={iconResults}
                  loading={!iconCatalogsLoaded}
                />
              ),
            },
            {
              id: 'technology',
              label: 'Technology',
              description:
                'Full-colour AWS, Azure, and generic-infrastructure icons for system-architecture diagrams.',
              icon: <TechTabIcon />,
              content: (
                <TechPickerTab
                  addTechIcon={addTechIcon}
                  techQuery={techQuery}
                  setTechQuery={setTechQuery}
                  techProvider={techProvider}
                  setTechProvider={setTechProvider}
                  techFilters={techFilters}
                  techResults={techResults}
                  loading={!iconCatalogsLoaded}
                />
              ),
            },
          ]}
        />
      </PaletteTintProvider>
    </MovablePanel>
  );
}
