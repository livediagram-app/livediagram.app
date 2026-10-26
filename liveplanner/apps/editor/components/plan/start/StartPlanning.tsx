'use client';

// Start Planning (docs/specs/026-plan/plan-mode.md "Starting a board"): an empty tab's start panel (StartPanel). A rail
// of categories (Recommended, Boards, Spreadsheets, Dashboards, Inspiration) beside a grid of large cards, each a
// picture of what it makes over its name, line and (a board's) card types; a search across all of them, which finds
// only Plan's own. Choosing a card acts at once. In the tab's own light or dark look (planPalette).
import { useEffect, useMemo, type ReactNode } from 'react';
import { DASHBOARD_PRESETS } from '@liveplanner/project';
import { lucideGlyph } from '@liveplanner/ui';
import {
  lucideChartPie,
  lucideClipboardList,
  lucideGrid3x3,
  lucideLayoutGrid,
  lucideLightbulb,
  lucideSquareKanban,
  lucideStar,
} from '@liveworkspace/icons/lucide';
import { StartPanel, type StartPanelCard } from '@/components/start/StartPanel';
import { StartSaveSwitch } from '@/components/start/StartSaveSwitch';
import type { PlanTemplateKind } from '@liveplanner/templates';
import type { Tab } from '@liveplanner/project';
import { TemplatePicture } from '@/components/start/template-card';
import { suggestedDashboards, type SuggestedDashboard } from '@/lib/suggested-dashboards';
import type { PlacedSheetStart } from '@/lib/sheet-seeds';
import { usePlan } from '../PlanContext';
import type { PlanPalette } from '../plan-palette';
import { BoardPreview, SHEET_TILES, SheetPreview } from '../PlanBoardPicker';
import { DashboardLayoutPicture } from '../DashboardLayoutPicture';
import { VisualisationPreview } from '../dashboard/slot-previews';
import { FormStarterPicture } from '@liveplanner/template-previews';
import type { StarterId } from '@liveplanner/forms';
import type { PlanVisualisation } from '@liveplanner/items';
import {
  KIND_NAMES,
  START_CATEGORIES,
  itemsIn,
  searchStartItems,
  startItems,
  type StartCategory,
  type StartItem,
} from './start-planning-items';
import { useStartPalette } from '@/components/start/useStartPalette';

const RAIL_ICONS: Record<StartCategory, ReturnType<typeof lucideGlyph>> = {
  recommended: lucideGlyph(lucideStar, 16),
  boards: lucideGlyph(lucideSquareKanban, 16),
  sheets: lucideGlyph(lucideGrid3x3, 16),
  forms: lucideGlyph(lucideClipboardList, 16),
  visualisations: lucideGlyph(lucideChartPie, 16),
  dashboards: lucideGlyph(lucideLayoutGrid, 16),
  inspiration: lucideGlyph(lucideLightbulb, 16),
};
// The most card types a board's card shows as chips; the rest are counted.
const CHIPS_MAX = 3;

function Picture({ item, palette }: { item: StartItem; palette: PlanPalette }) {
  if (item.kind === 'board') return <BoardPreview preset={item.preset} palette={palette} />;
  // A template's preview is light-canvas art, on a re-lit tile, as every start draws one.
  if (item.kind === 'template') return <TemplatePicture kind={item.template} />;
  if (item.kind === 'visualisation')
    return <VisualisationPreview view={item.view} palette={palette} />;
  if (item.kind === 'form') return <FormStarterPicture starter={item.starter} palette={palette} />;
  if (item.kind === 'sheet') {
    const tile = SHEET_TILES.find((t) => t.start === item.start) ?? SHEET_TILES[0]!;
    return <SheetPreview palette={palette} tile={tile} />;
  }
  if (item.suggestion)
    return (
      <DashboardLayoutPicture
        rows={item.suggestion.rows.map((r) => [r.height, r.slots.map((x) => x.span)] as const)}
        palette={palette}
      />
    );
  const preset = DASHBOARD_PRESETS.find((p) => p.id === item.layout)!;
  return <DashboardLayoutPicture rows={preset.rows} palette={palette} />;
}

// A Start Planning choice as the panel's card: its picture, one badge at most (a suggestion's For You, else its kind
// where kinds mix), its tab count and a board's card types as chips.
function toCard(item: StartItem, palette: PlanPalette, showKind: boolean): StartPanelCard {
  const chips = item.types?.slice(0, CHIPS_MAX) ?? [];
  const more = (item.types?.length ?? 0) - chips.length;
  const badge =
    item.kind === 'dashboard' && item.suggestion
      ? 'For You'
      : showKind
        ? KIND_NAMES[item.kind]
        : undefined;
  return {
    id: item.id,
    name: item.name,
    line: item.line,
    picture: <Picture item={item} palette={palette} />,
    ...(badge ? { badge } : {}),
    ...(showKind ? { ariaKind: KIND_NAMES[item.kind] } : {}),
    ...(item.tabs ? { tag: `${item.tabs} ${item.tabs === 1 ? 'Tab' : 'Tabs'}` } : {}),
    footer:
      chips.length || item.typesNote ? (
        <span className="mt-1 flex flex-wrap gap-1">
          {item.typesNote ? (
            <Chip palette={palette}>{item.typesNote}</Chip>
          ) : (
            chips.map((t) => (
              <Chip key={t.label} palette={palette} dot={t.color}>
                {t.label}
              </Chip>
            ))
          )}
          {more > 0 ? <Chip palette={palette}>+{more}</Chip> : null}
        </span>
      ) : undefined,
  };
}

function Chip({
  palette,
  dot,
  children,
}: {
  palette: PlanPalette;
  dot?: string;
  children: ReactNode;
}) {
  return (
    <span
      className="flex items-center gap-1 rounded-full border px-1.5 py-px text-[11px]"
      style={{ borderColor: palette.border, color: palette.muted }}
    >
      {dot ? (
        <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dot }} />
      ) : null}
      {/* The label centres on its cap band, keeping the chip one line tall (optical-alignment.md). */}
      <span className="text-optical-line">{children}</span>
    </span>
  );
}

export function StartPlanning({
  onPickBoard,
  onPickSheet,
  onDashboard,
  onTemplate,
  tabs,
  loadTabs,
  onSuggestedDashboard,
  onVisualisation,
  onForm,
}: {
  onPickBoard: (preset: string) => void;
  // Absent where sheets cannot be placed: Spreadsheets is left out.
  onPickSheet?: ((start?: PlacedSheetStart) => void) | undefined;
  // Absent where the tab cannot become a Dashboard: Dashboards is left out.
  onDashboard?: ((presetId: string) => void) | undefined;
  // Applies a Plan template to this tab (Inspiration); absent, Inspiration is left out.
  onTemplate?: ((kind: PlanTemplateKind) => void) | undefined;
  // The project's tabs, read for Dashboards built from its own work (suggested-dashboards.ts), and the fetch of
  // their content, asked for as the panel opens so every board is read.
  tabs?: readonly Tab[] | undefined;
  loadTabs?: (() => Promise<unknown>) | undefined;
  onSuggestedDashboard?: ((s: SuggestedDashboard) => void) | undefined;
  // Makes the tab one chart filling the page (Visualisations); absent, Visualisations is left out.
  onVisualisation?: ((view: PlanVisualisation, name: string) => void) | undefined;
  // Makes the tab a Form tab from a starter (Forms); absent, Forms is left out.
  onForm?: ((starter: StarterId) => void) | undefined;
}) {
  // The tab's own colours (start-palette.ts).
  const palette = useStartPalette();
  const plan = usePlan();
  const hasCards = (plan?.items.size ?? 0) > 0;
  // Fetched as the panel opens; the effect returns nothing (the fetch is a promise).
  useEffect(() => {
    void loadTabs?.();
  }, [loadTabs]);
  const suggestions = useMemo(
    () =>
      tabs && onDashboard && onSuggestedDashboard ? suggestedDashboards(tabs, plan?.types) : [],
    [tabs, plan?.types, onDashboard, onSuggestedDashboard],
  );
  const items = useMemo(
    () =>
      startItems({ hasCards, suggestions }).filter(
        (i) =>
          (i.kind !== 'sheet' || !!onPickSheet) &&
          (i.kind !== 'dashboard' || !!onDashboard) &&
          (i.kind !== 'template' || !!onTemplate) &&
          (i.kind !== 'visualisation' || !!onVisualisation) &&
          (i.kind !== 'form' || !!onForm),
      ),
    [hasCards, suggestions, onPickSheet, onDashboard, onTemplate, onVisualisation, onForm],
  );
  const categories = START_CATEGORIES.filter((c) => itemsIn(items, c.id).length > 0).map((c) => ({
    ...c,
    icon: RAIL_ICONS[c.id],
    below: c.id === 'inspiration',
  }));
  const choose = (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    if (item.kind === 'board') onPickBoard(item.preset);
    else if (item.kind === 'sheet') onPickSheet?.(item.start ?? undefined);
    else if (item.kind === 'template') onTemplate?.(item.template);
    else if (item.kind === 'visualisation') onVisualisation?.(item.view, item.name);
    else if (item.kind === 'form') onForm?.(item.starter);
    else if (item.suggestion) onSuggestedDashboard?.(item.suggestion);
    else if (item.layout) onDashboard?.(item.layout);
  };
  return (
    <StartPanel
      titleId="start-planning-title"
      title="Start Planning"
      line="Pick how to run the work. You can add more boards, sheets, forms and dashboards later."
      searchLabel="Find a board, sheet, form or layout"
      noMatchNoun="boards, sheets, forms or layouts"
      helpArticle="planBoards"
      palette={palette}
      categories={categories}
      initialCategory="recommended"
      cardsIn={(category) =>
        itemsIn(items, category).map((item) => toCard(item, palette, category === 'recommended'))
      }
      search={(query) =>
        searchStartItems(items, query).map((g) => ({
          category: g.category,
          cards: g.items.map((item) => toCard(item, palette, false)),
        }))
      }
      onChoose={choose}
      // Where the new plan lives, and a switch to move it while it is empty (save-locations.md "On the start screen").
      footer={(p) => <StartSaveSwitch palette={p} />}
    />
  );
}
