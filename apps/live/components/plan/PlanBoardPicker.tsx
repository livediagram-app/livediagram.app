'use client';

// A Plan tab with nothing on it (docs/specs/026-plan/plan-mode.md "Starting a board"): Start Planning, in the middle
// of the canvas, offers a Boards tab (open first) and a Spreadsheets tab (an Empty Sheet). The Boards tab offers the board types, as a new infographic page offers its layouts. Each is a picture of the board
// itself, drawn as what sets it apart (board-previews.tsx) over its name and what it is
// for, in the tab's own light or dark look. Blank comes first; the Archive board, never a first board, is
// left to the palette. Choosing one places that board, empty, in the
// middle of the view. Gone once the tab has a board; never shown to someone who may only view.
import { usePlan } from './PlanContext';
import type { PlacedSheetStart } from '@/lib/sheet-seeds';
import { useState } from 'react';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { SparkleIcon } from '@livediagram/ui';
import {
  READY_MADE_CARD_TYPES,
  ITEM_TYPES,
  PLAN_BOARD_PRESETS,
  boardAddTypes,
  type PlanBoardPresetId,
} from '@livediagram/items';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { PLAN_BOARD_TILES } from '@/components/palette/palette-plan-tiles';
import { accentOn, planPalette, type PlanPalette } from './plan-palette';
import { BOARD_PREVIEWS } from './board-previews';

// The most columns a preview draws.
const PREVIEW_COLUMNS = 5;
// Cards per preview column, a gentle pattern so each column reads as work in flight.
const CARD_PATTERN = [3, 2, 3, 1, 2];

// The Spreadsheets tab's sheet types (docs/specs/026-plan/plan-mode.md "Start Planning"): the empty sheet, then
// starts that open Setup Sheet a step in (sheet-seeds' PlacedSheetStart).
type SheetTile = {
  start: PlacedSheetStart | null;
  name: string;
  line: string;
  // What a 4 x 4 preview cell holds, below its tinted header row: a bar of text, a number, a coloured chip.
  cell: (row: number, col: number) => 'text' | 'number' | 'chip' | 'active' | 'total' | null;
};

const SHEET_TILES: readonly SheetTile[] = [
  {
    start: null,
    name: 'Empty Sheet',
    line: 'Set it up next: a layout, your cards or a blank grid.',
    cell: (r, c) => (r === 1 && c === 1 ? 'active' : null),
  },
  {
    start: 'cards',
    name: 'Card Table',
    line: 'Your cards of a type as rows, linked both ways. Pick which next.',
    cell: (_r, c) => (c === 0 ? 'chip' : c === 3 ? 'chip' : 'text'),
  },
  {
    start: 'budget',
    name: 'Budget',
    line: 'Items, categories and amounts, with a total.',
    cell: (r, c) => (r === 3 ? (c === 0 || c === 3 ? 'total' : null) : c === 3 ? 'number' : 'text'),
  },
  {
    start: 'tracker',
    name: 'Tracker',
    line: 'Tasks, owners, a status and due dates.',
    cell: (_r, c) => (c === 2 ? 'chip' : c === 3 ? 'number' : 'text'),
  },
];

// The chips' colours, in turn down a column (a type's or a status's).
const CHIP_COLOURS = ['#0ea5e9', '#8b5cf6', '#10b981'];

// A sheet drawn small: a tinted header row, then the type's rows.
function SheetPreview({ palette, tile }: { palette: PlanPalette; tile: SheetTile }) {
  return (
    <div
      aria-hidden
      className="grid h-16 w-full grid-cols-4 grid-rows-4 overflow-hidden rounded-lg border sm:h-24"
      style={{ backgroundColor: palette.surface, borderColor: palette.border }}
    >
      {Array.from({ length: 16 }, (_, i) => {
        const r = Math.floor(i / 4);
        const c = i % 4;
        const what = r === 0 ? null : tile.cell(r, c);
        return (
          <span
            key={i}
            className={`flex items-center border-b border-r px-1 ${c === 3 && what === 'number' ? 'justify-end' : ''}`}
            style={{
              borderColor: palette.cardBorder,
              backgroundColor:
                r === 0
                  ? palette.column
                  : what === 'active'
                    ? `color-mix(in srgb, ${palette.focus} 25%, transparent)`
                    : what === 'total'
                      ? `color-mix(in srgb, ${palette.focus} 12%, transparent)`
                      : undefined,
              boxShadow: what === 'active' ? `inset 0 0 0 1.5px ${palette.focus}` : undefined,
            }}
          >
            {what === 'text' || what === 'total' ? (
              <span
                className="h-1 rounded-full"
                style={{
                  width: `${what === 'total' ? 70 : 45 + ((i * 17) % 40)}%`,
                  backgroundColor: palette.muted,
                  opacity: what === 'total' ? 0.9 : 0.45,
                }}
              />
            ) : what === 'number' ? (
              <span
                className="h-1 w-1/3 rounded-full"
                style={{ backgroundColor: palette.text, opacity: 0.55 }}
              />
            ) : what === 'chip' ? (
              <span
                className="h-1.5 w-2/3 rounded-full"
                style={{
                  backgroundColor: CHIP_COLOURS[(r + c) % CHIP_COLOURS.length],
                  opacity: 0.8,
                }}
              />
            ) : null}
          </span>
        );
      })}
    </div>
  );
}

function BoardPreview({ preset, palette }: { preset: PlanBoardPresetId; palette: PlanPalette }) {
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

type PickerTab = 'boards' | 'sheets';

export function PlanBoardPicker({
  onPick,
  onPickSheet,
  onQuickStart,
}: {
  onPick: (preset: string) => void;
  // Places an empty Sheet (which then offers Setup Sheet).
  // An empty sheet, or one of Start Planning's sheet types (Setup Sheet then opens on it).
  onPickSheet?: (start?: PlacedSheetStart) => void;
  // Opens the regular Quick Start for this tab (a diagram template or another kind of tab instead).
  onQuickStart?: () => void;
}) {
  const palette = planPalette(useCanvasSurface(), {});
  const [tab, setTab] = useState<PickerTab>('boards');
  const hasCards = (usePlan()?.items.size ?? 0) > 0;
  // Switched at least once: the tiles cascade in on a switch, never on the picker's first paint (motion.md).
  const [switched, setSwitched] = useState(false);
  const cascade = switched ? ' lvd-cascade' : '';
  const tabButton = (id: PickerTab, label: string) => (
    <button
      key={id}
      type="button"
      role="tab"
      id={`plan-start-${id}`}
      aria-selected={tab === id}
      aria-controls={`plan-start-${id}-panel`}
      onClick={() => {
        if (id !== tab) setSwitched(true);
        setTab(id);
      }}
      className={`rounded-md px-3 py-1 text-[13px] font-medium transition ${
        tab === id ? 'shadow-sm' : 'hover:opacity-80'
      }`}
      style={
        tab === id
          ? { backgroundColor: palette.surface, color: palette.text }
          : { color: palette.muted }
      }
    >
      {label}
    </button>
  );
  return (
    <div className="pointer-events-none absolute inset-0 z-[var(--z-panel)] flex items-center justify-center p-4 pb-40 pt-24 max-sm:px-3 max-sm:pb-28 max-sm:pt-32">
      <section
        aria-labelledby="plan-board-picker-title"
        className="pointer-events-auto max-h-full w-full max-w-3xl animate-fade-in overflow-y-auto overscroll-contain rounded-2xl border p-4 shadow-xl sm:p-6"
        style={{ backgroundColor: palette.card, borderColor: palette.border, color: palette.text }}
      >
        <div className="flex items-center gap-2">
          <h2 id="plan-board-picker-title" className="text-[17px] font-semibold">
            Start Planning
          </h2>
          <HelpArticleLink article="planBoards" variant="icon" />
        </div>
        <p className="mt-1 text-[13px]" style={{ color: palette.muted }}>
          {tab === 'boards'
            ? 'Pick the board that fits the work. More are in the palette’s Boards whenever you need them.'
            : 'A spreadsheet beside your boards: cells, formulas, charts and your cards as rows.'}
        </p>
        <div
          role="tablist"
          aria-label="Start Planning"
          className="mt-3 inline-flex gap-0.5 rounded-lg p-0.5"
          style={{ backgroundColor: palette.column }}
        >
          {tabButton('boards', 'Boards')}
          {tabButton('sheets', 'Spreadsheets')}
        </div>

        {tab === 'sheets' ? (
          <div
            role="tabpanel"
            id="plan-start-sheets-panel"
            aria-labelledby="plan-start-sheets"
            className={`mt-4 grid grid-cols-2 gap-2 sm:gap-3${cascade}`}
          >
            {/* Each tile in a cell of its own: the cascade moves the cell, the tile keeps its hover lift. Card Table
                only when there are cards to put in it. */}
            {SHEET_TILES.filter((t) => t.start !== 'cards' || hasCards).map((t) => (
              <div key={t.name} className="flex">
                <button
                  type="button"
                  onClick={() => onPickSheet?.(t.start ?? undefined)}
                  className="group flex w-full flex-col gap-2.5 rounded-xl border p-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                  style={{
                    borderColor: palette.border,
                    backgroundColor: palette.surface,
                    ['--tw-ring-color' as string]: palette.focus,
                  }}
                >
                  <SheetPreview palette={palette} tile={t} />
                  <span className="px-0.5">
                    <span
                      className="block text-[13px] font-semibold"
                      style={{ color: palette.text }}
                    >
                      {t.name}
                    </span>
                    <span
                      className="mt-0.5 block text-[12px] leading-snug"
                      style={{ color: palette.muted }}
                    >
                      {t.line}
                    </span>
                  </span>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div
            role="tabpanel"
            id="plan-start-boards-panel"
            aria-labelledby="plan-start-boards"
            className={`mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3${cascade}`}
          >
            {PLAN_BOARD_TILES.filter((t) => t.preset !== 'archive').map((t) => (
              <div key={t.preset} className="flex">
                <button
                  type="button"
                  onClick={() => onPick(t.preset)}
                  className="group flex w-full flex-col gap-2.5 rounded-xl border p-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
                  style={{
                    borderColor: palette.border,
                    backgroundColor: palette.surface,
                    ['--tw-ring-color' as string]: palette.focus,
                  }}
                >
                  <BoardPreview preset={t.preset} palette={palette} />
                  <span className="px-0.5">
                    <span
                      className="block text-[13px] font-semibold"
                      style={{ color: palette.text }}
                    >
                      {PLAN_BOARD_PRESETS[t.preset].label.replace(/ Board$/, '')}
                    </span>
                    <span
                      className="mt-0.5 block text-[12px] leading-snug"
                      style={{ color: palette.muted }}
                    >
                      {t.description}
                    </span>
                  </span>
                </button>
              </div>
            ))}
          </div>
        )}
        {onQuickStart ? (
          <div className="mt-4 flex justify-center sm:mt-5">
            <button
              type="button"
              onClick={onQuickStart}
              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[13px] font-medium transition hover:shadow-sm focus-visible:outline-none focus-visible:ring-2"
              style={{
                borderColor: palette.border,
                backgroundColor: palette.surface,
                color: palette.muted,
                ['--tw-ring-color' as string]: palette.focus,
              }}
            >
              <SparkleIcon size={14} />
              Open Quick Start
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
