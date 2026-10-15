'use client';

// A Plan tab with nothing on it (docs/specs/026-plan/plan-mode.md "Starting a board"): Start Planning, in the middle
// of the canvas, first asks what to start with (PlanStartChooser: Boards, Spreadsheets, or Other, the Quick Start);
// Boards and Spreadsheets then open their step, a breadcrumb leading back. Boards offers the board types, as a new
// infographic page offers its layouts. Each is a picture of the board
// itself, drawn as what sets it apart (board-previews.tsx) over its name and what it is
// for, in the tab's own light or dark look. Blank comes first; the Archive board, never a first board, is
// left to the palette. Choosing one places that board, empty, in the
// middle of the view. Gone once the tab has a board; never shown to someone who may only view.
import { useEffect } from 'react';
import type { PlacedSheetStart } from '@/lib/sheet-seeds';
import {
  READY_MADE_CARD_TYPES,
  ITEM_TYPES,
  PLAN_BOARD_PRESETS,
  boardAddTypes,
  type PlanBoardPresetId,
} from '@livediagram/items';
import { accentOn, type PlanPalette } from './plan-palette';
import { BOARD_PREVIEWS } from './board-previews';
import { StartPlanning } from './start/StartPlanning';
import type { PlanTemplateKind } from '@livediagram/templates';
import type { Tab } from '@livediagram/document';
import type { SuggestedDashboard } from '@/lib/suggested-dashboards';
import type { PlanVisualisation } from '@livediagram/items';

// The most columns a preview draws.
const PREVIEW_COLUMNS = 5;
// Cards per preview column, a gentle pattern so each column reads as work in flight.
const CARD_PATTERN = [3, 2, 3, 1, 2];

// The Spreadsheets pictures live in sheet-previews.tsx; Start Planning and Add to Slot read them from here too.
export { SHEET_TILES, SheetPreview } from './sheet-previews';

export function BoardPreview({
  preset,
  palette,
}: {
  preset: PlanBoardPresetId;
  palette: PlanPalette;
}) {
  const Picture = BOARD_PREVIEWS[preset];
  return Picture ? (
    <Picture palette={palette} />
  ) : (
    <GenericPreview preset={preset} palette={palette} />
  );
}

// A board drawn from its preset (its columns, rows and card colours), for a preset with no picture of its own.
function GenericPreview({ preset, palette }: { preset: PlanBoardPresetId; palette: PlanPalette }) {
  const setup = PLAN_BOARD_PRESETS[preset].setup;
  // Cards in the colours of the types it would bring: its own (a Bug Triage board's red Bugs), else the defaults.
  const colours = boardAddTypes(setup, setup.addTypes ? READY_MADE_CARD_TYPES : ITEM_TYPES).map(
    (t) => accentOn(t.color, palette),
  );
  const columns = setup.columns.slice(0, PREVIEW_COLUMNS);
  const lanes = setup.swimlaneBy === 'none' ? 1 : 2;
  const empty = preset === 'blank';
  return (
    <div
      aria-hidden
      className="flex h-16 w-full flex-col gap-1 overflow-hidden rounded-lg border p-1.5 sm:h-24"
      style={{ backgroundColor: palette.surface, borderColor: palette.border }}
    >
      <span
        className="h-1.5 w-1/3 rounded-full"
        style={{ backgroundColor: palette.muted, opacity: 0.5 }}
      />
      <div className="flex min-h-0 flex-1 gap-1">
        {columns.map((c, ci) => (
          <div
            key={c.id}
            className="flex min-w-0 flex-1 flex-col gap-[3px] rounded p-[3px]"
            style={{ backgroundColor: palette.column }}
          >
            <span
              className="h-[3px] w-full rounded-full"
              style={{ backgroundColor: c.color ?? palette.border }}
            />
            {Array.from({ length: lanes }, (_, li) => (
              <div key={li} className="flex flex-col gap-[3px]">
                {li > 0 ? (
                  <span className="h-px w-full" style={{ backgroundColor: palette.border }} />
                ) : null}
                {empty
                  ? null
                  : Array.from(
                      {
                        length: Math.max(
                          1,
                          (CARD_PATTERN[(ci + li) % CARD_PATTERN.length] ?? 1) - li,
                        ),
                      },
                      (_, k) => (
                        <span
                          key={k}
                          className="relative h-2.5 overflow-hidden rounded-[2px] border"
                          style={{ backgroundColor: palette.card, borderColor: palette.cardBorder }}
                        >
                          <span
                            className="absolute inset-y-0 left-0 w-[2px]"
                            style={{
                              backgroundColor:
                                colours[(ci + k + li) % Math.max(1, colours.length)] ??
                                palette.focus,
                            }}
                          />
                        </span>
                      ),
                    )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

// Start Planning (docs/specs/026-plan/plan-mode.md "Starting a board"): the panel lives in start/StartPlanning.tsx; the
// pictures it draws stay here, where Add to Slot reads them too.
export function PlanBoardPicker({
  onPick,
  onPickSheet,
  onQuickStart,
  onDashboard,
  onTemplate,
  tabs,
  loadTabs,
  onSuggestedDashboard,
  onVisualisation,
}: {
  onPick: (preset: string) => void;
  // The document's tabs and their fetch, and making a Dashboard built from its work (Start Planning's Dashboards).
  tabs?: readonly Tab[];
  loadTabs?: () => void;
  onSuggestedDashboard?: (s: SuggestedDashboard) => void;
  // Makes the tab one chart filling the page (Start Planning's Visualisations).
  onVisualisation?: (view: PlanVisualisation, name: string) => void;
  // Applies a Plan template to the tab (Start Planning's Inspiration).
  onTemplate?: (kind: PlanTemplateKind) => void;
  // Makes the tab a Dashboard of a preset layout (docs/specs/026-plan/plan-tabs.md).
  onDashboard?: (presetId: string) => void;
  // An empty sheet, or one of Start Planning's sheet types (Setup Sheet then opens on it).
  onPickSheet?: (start?: PlacedSheetStart) => void;
  // Opens the regular Quick Start for this tab (a diagram template or another kind of tab instead).
  onQuickStart?: () => void;
}) {
  // What Start Planning makes fills the tab: its view's chunk is fetched while the panel is read, so the choice
  // opens on the view rather than its loading cover (FillTabPending). Idle, so the panel's own paint is first.
  useEffect(() => {
    const warm = () => {
      void import('@/components/sheets/PlanSheetView');
      void import('@/components/plan/PlanBoardView');
      void import('@/components/plan/views/PlanViewView');
    };
    if (typeof requestIdleCallback === 'undefined') {
      const t = window.setTimeout(warm, 200);
      return () => window.clearTimeout(t);
    }
    const handle = requestIdleCallback(warm, { timeout: 1000 });
    return () => cancelIdleCallback(handle);
  }, []);
  return (
    <StartPlanning
      onPickBoard={onPick}
      onPickSheet={onPickSheet}
      onDashboard={onDashboard}
      onQuickStart={onQuickStart}
      onTemplate={onTemplate}
      tabs={tabs}
      loadTabs={loadTabs}
      onSuggestedDashboard={onSuggestedDashboard}
      onVisualisation={onVisualisation}
    />
  );
}
