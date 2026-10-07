'use client';

// A Plan tab with no board (docs/specs/026-plan/plan-mode.md "Starting a board"): the middle of the canvas
// offers the board types, as a new infographic page offers its layouts. Each is a picture of the board
// itself (its columns, its rows, cards in the colours of the types it takes) over its name and what it is
// for, in the tab's own light or dark look. Blank comes first; the Archive board, never a first board, is
// left to the palette. Choosing one places that board, empty, in the
// middle of the view. Gone once the tab has a board; never shown to someone who may only view.
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { SparkleIcon } from '@livediagram/ui';
import {
  ITEM_TYPES,
  PLAN_BOARD_PRESETS,
  boardAddTypes,
  type PlanBoardPresetId,
} from '@livediagram/items';
import { useCanvasSurface } from '@/components/canvas/CanvasSurfaceContext';
import { PLAN_BOARD_TILES } from '@/components/palette/palette-plan-tiles';
import { accentOn, planPalette, type PlanPalette } from './plan-palette';

// The most columns a preview draws.
const PREVIEW_COLUMNS = 5;
// Cards per preview column, a gentle pattern so each column reads as work in flight.
const CARD_PATTERN = [3, 2, 3, 1, 2];

function BoardPreview({ preset, palette }: { preset: PlanBoardPresetId; palette: PlanPalette }) {
  const setup = PLAN_BOARD_PRESETS[preset].setup;
  const colours = boardAddTypes(setup, ITEM_TYPES).map((t) => accentOn(t.color, palette));
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

export function PlanBoardPicker({
  onPick,
  onQuickStart,
}: {
  onPick: (preset: string) => void;
  // Opens the regular Quick Start for this tab (a diagram template or another kind of tab instead).
  onQuickStart?: () => void;
}) {
  const palette = planPalette(useCanvasSurface(), {});
  return (
    <div className="pointer-events-none absolute inset-0 z-[var(--z-panel)] flex items-center justify-center p-4 pb-40 pt-24 max-sm:px-3 max-sm:pb-28 max-sm:pt-32">
      <section
        aria-labelledby="plan-board-picker-title"
        className="pointer-events-auto max-h-full w-full max-w-3xl animate-fade-in overflow-y-auto overscroll-contain rounded-2xl border p-4 shadow-xl sm:p-6"
        style={{ backgroundColor: palette.card, borderColor: palette.border, color: palette.text }}
      >
        <div className="flex items-center gap-2">
          <h2 id="plan-board-picker-title" className="text-[17px] font-semibold">
            Start with a Board
          </h2>
          <HelpArticleLink article="planBoards" variant="icon" />
        </div>
        <p className="mt-1 text-[13px]" style={{ color: palette.muted }}>
          Pick the board that fits the work. More are in the palette&rsquo;s Boards whenever you
          need them.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-3 md:grid-cols-3">
          {PLAN_BOARD_TILES.filter((t) => t.preset !== 'archive').map((t) => (
            <button
              key={t.preset}
              type="button"
              onClick={() => onPick(t.preset)}
              className="group flex flex-col gap-2.5 rounded-xl border p-2.5 text-left transition hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              style={{
                borderColor: palette.border,
                backgroundColor: palette.surface,
                ['--tw-ring-color' as string]: palette.focus,
              }}
            >
              <BoardPreview preset={t.preset} palette={palette} />
              <span className="px-0.5">
                <span className="block text-[13px] font-semibold" style={{ color: palette.text }}>
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
          ))}
        </div>
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
