'use client';

// A start panel's card (StartPanel, docs/specs/007-editor/start-panel.md "The panel"): a picture of what it makes
// over its name and line, larger than it draws elsewhere, in the tab's own colours (the palette), and the grid they sit
// in. Shared by a start's own groups, its search results and the other modes' matches (StartOtherModes).
import type { ReactNode } from 'react';
import type { PlanPalette } from '@/components/plan/plan-palette';
import { tint } from '@/components/plan/plan-card-parts';
import { mixHex, readableInk } from '@liveplanner/project';

export type StartPanelCard = {
  id: string;
  name: string;
  line: string;
  picture: ReactNode;
  // One badge at most, beside the name (a kind where kinds mix, For You).
  badge?: string;
  // A count on the right of the name row (a template's tabs).
  tag?: string;
  // What a screen reader hears after the name (its kind).
  ariaKind?: string;
  // Under the line (a board's card-type chips), on a desktop only.
  footer?: ReactNode;
  // Under the line at every width: where the card leads ("Opens in Workshop", StartOtherModes).
  note?: ReactNode;
};

// The accent at a strength, as a Plan card's tints are (plan-card-parts).
export const startTint = (palette: PlanPalette, pct: number) => tint(palette.focus, pct);

// How strongly a card's badge is tinted, and its ink: the accent, deepened (or lifted) until it reads at AA on the
// badge as drawn, the tint over the card's surface (the accent alone read 4.43:1 on the violet theme's badge).
const BADGE_TINT = 14;
export function startBadgeInk(palette: PlanPalette): string {
  return readableInk(palette.focus, mixHex(palette.focus, palette.surface, BADGE_TINT / 100));
}

function StartCard({
  card,
  palette,
  onChoose,
}: {
  card: StartPanelCard;
  palette: PlanPalette;
  onChoose: () => void;
}) {
  return (
    // A cell of its own: the cascade moves the cell, the card keeps its hover lift.
    <div className="flex">
      <button
        type="button"
        data-start-card={card.id}
        onClick={onChoose}
        aria-label={`${card.name}${card.ariaKind ? ` ${card.ariaKind}` : ''}: ${card.line}`}
        // On a phone a row: the picture small at the left, the words beside it, so a screen holds several.
        className="group flex w-full cursor-pointer flex-col rounded-2xl border p-2 text-left max-sm:flex-row max-sm:items-center max-sm:gap-1 max-sm:rounded-xl transition duration-micro ease-out hover:-translate-y-0.5 hover:border-[var(--start-accent)] hover:shadow-lg focus-visible:-translate-y-0.5 focus-visible:border-[var(--start-accent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--start-accent)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
        style={{ borderColor: palette.border, backgroundColor: palette.surface }}
      >
        {/* The picture, larger than it draws elsewhere, on a soft panel of the board's column colour. */}
        <span
          className="flex h-28 w-full items-center justify-center overflow-hidden rounded-xl p-3 max-sm:h-[4.5rem] max-sm:w-24 max-sm:shrink-0 max-sm:rounded-lg max-sm:p-1.5 [&>*]:!h-full"
          style={{ backgroundColor: palette.column }}
        >
          {card.picture}
        </span>
        <span className="flex min-w-0 flex-col gap-1 px-1.5 pb-1 pt-2.5 max-sm:flex-1 max-sm:py-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-[14px] font-semibold" style={{ color: palette.text }}>
              {card.name}
            </span>
            {card.badge ? (
              <span
                className="shrink-0 rounded-full px-1.5 py-px text-[10px] font-semibold uppercase tracking-wide"
                style={{
                  backgroundColor: startTint(palette, BADGE_TINT),
                  color: startBadgeInk(palette),
                }}
              >
                {card.badge}
              </span>
            ) : null}
            {card.tag ? (
              <span
                className="ml-auto shrink-0 rounded-full border px-1.5 py-px text-[10px] font-semibold tabular-nums"
                style={{ borderColor: palette.border, color: palette.muted }}
              >
                {card.tag}
              </span>
            ) : null}
          </span>
          <span
            // In full, on a phone too: a card's line is short, and cut it misleads.
            className="text-[12.5px] leading-snug"
            style={{ color: palette.muted }}
          >
            {card.line}
          </span>
          {card.footer ? <span className="max-sm:hidden">{card.footer}</span> : null}
          {card.note ? <span className="flex">{card.note}</span> : null}
        </span>
      </button>
    </div>
  );
}

// One a row on a phone (each card a row of its own), two on a narrow panel, three on a wide one. `cascade` lets the
// cards arrive one after another (lvd-cascade), as they do when the category or search changes.
export function StartCardGrid({
  cards,
  palette,
  cascade,
  onChoose,
}: {
  cards: readonly StartPanelCard[];
  palette: PlanPalette;
  cascade: boolean;
  onChoose: (cardId: string) => void;
}) {
  return (
    <div
      className={`grid grid-cols-1 gap-3 max-sm:gap-2 sm:grid-cols-2 lg:grid-cols-3${cascade ? ' lvd-cascade' : ''}`}
    >
      {cards.map((card) => (
        <StartCard key={card.id} card={card} palette={palette} onChoose={() => onChoose(card.id)} />
      ))}
    </div>
  );
}
