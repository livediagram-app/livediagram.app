'use client';

// Add to Slot's categories (docs/specs/026-plan/plan-tabs.md "Filling a slot"): each a card with a picture of what it
// holds (the slot previews' own art, small), its glyph, its name, how many choices it has (the shared CountBadge) and
// a line of what is inside. Pressing one drills into it (SlotFillPicker).
import type { CSSProperties, ReactNode } from 'react';
import { CountBadge, Glyph, lucideGlyph } from '@livepages/ui';
import {
  lucideChartColumn,
  lucideClipboardList,
  lucidePanelsTopLeft,
  lucideSquareKanban,
  lucideStickyNote,
  lucideTable,
} from '@livepages/icons/lucide';
import type { PlanPalette } from '../plan-palette';
import { BoardPreview, SHEET_TILES, SheetPreview } from '../PlanBoardPicker';
import { MetricPreview, VisualisationPreview } from './slot-previews';
import {
  CardPreview,
  DiagramPreview,
  FormMetricPreview,
  SheetMetricPreview,
} from './card-previews';

// A gauge: a half ring and its needle.
function GaugeGlyph() {
  return (
    <Glyph size={16} units={20}>
      <path d="M3 14.5a7 7 0 0 1 14 0" />
      <path d="M10 14.5l3.5-4.5" />
    </Glyph>
  );
}
// A sheet's grid with a line climbing over it.
function SheetLineGlyph() {
  return (
    <Glyph size={16} units={20}>
      <rect x={2.5} y={3} width={15} height={14} rx={2} strokeOpacity={0.55} />
      <path d="M5.5 13.5l3-3.5 2.5 2 3.5-4.5" />
    </Glyph>
  );
}

type Info = {
  icon: ReactNode;
  description: string;
  picture: (palette: PlanPalette) => ReactNode;
};

const PanelsGlyph = lucideGlyph(lucidePanelsTopLeft, 16);
const BoardGlyph = lucideGlyph(lucideSquareKanban, 16);
const TableGlyph = lucideGlyph(lucideTable, 16);
const ChartGlyph = lucideGlyph(lucideChartColumn, 16);
const NoteGlyph = lucideGlyph(lucideStickyNote, 16);
const FormGlyph = lucideGlyph(lucideClipboardList, 16);

/** Add to Slot's categories, in order (docs/specs/026-plan/plan-tabs.md "Filling a slot"). The picker builds its
 *  sections from these names and each card looks its art up by them, so the two cannot name a category differently:
 *  the picker said "Card Metrics" where the art was filed under "Metrics", and that card showed no picture, glyph or
 *  description. */
export const SLOT_CATEGORIES = [
  'This Document’s Tabs',
  'New Board',
  'New Sheet',
  'Card Metrics',
  'Form Metrics',
  'Visualisations',
  'From a Sheet',
  'Utilities',
] as const;
export type SlotCategory = (typeof SLOT_CATEGORIES)[number];

// Two cards fanned behind the one in front: a stack of cards to write.
function StackedCards({ palette }: { palette: PlanPalette }) {
  const back = { backgroundColor: palette.card, borderColor: palette.border };
  return (
    <span className="relative block pr-4 pt-3">
      <span className="absolute bottom-3 left-4 right-0 top-0 rounded-lg border" style={back} />
      <span className="absolute bottom-1.5 left-2 right-2 top-1.5 rounded-lg border" style={back} />
      <span className="relative block">
        <CardPreview card="checklist" palette={palette} />
      </span>
    </span>
  );
}

const SLOT_CATEGORY_INFO: Record<SlotCategory, Info> = {
  'This Document’s Tabs': {
    icon: <PanelsGlyph />,
    description: 'Your boards, sheets and diagrams, live.',
    picture: (p) => <DiagramPreview palette={p} />,
  },
  'New Board': {
    icon: <BoardGlyph />,
    description: 'A fresh board of any preset.',
    picture: (p) => <BoardPreview preset="kanban" palette={p} />,
  },
  'New Sheet': {
    icon: <TableGlyph />,
    description: 'A blank grid, a budget or a tracker.',
    picture: (p) => <SheetPreview palette={p} tile={SHEET_TILES[1] ?? SHEET_TILES[0]!} />,
  },
  'Card Metrics': {
    icon: <GaugeGlyph />,
    description: 'Counts and progress across every card.',
    picture: (p) => <MetricPreview kind="progress" label="Completion" palette={p} />,
  },
  'Form Metrics': {
    icon: <FormGlyph />,
    description: 'Responses, status and dates from a form.',
    picture: (p) => <FormMetricPreview metric="responses" palette={p} />,
  },
  Visualisations: {
    icon: <ChartGlyph />,
    description: 'Gantt, calendars, workload and more.',
    picture: (p) => <VisualisationPreview view="gantt" palette={p} />,
  },
  'From a Sheet': {
    icon: <SheetLineGlyph />,
    description: 'Figures and charts read live from a sheet.',
    picture: (p) => <SheetMetricPreview metric="trend" palette={p} />,
  },
  Utilities: {
    icon: <NoteGlyph />,
    description: 'Notes, status, checklists, dates and links.',
    picture: (p) => <StackedCards palette={p} />,
  },
};

// Card chrome shared by a category and a choice: a lift and a brand-tinted edge on hover, a ring on focus.
export const PICK_CARD =
  'group flex min-w-0 cursor-pointer flex-col rounded-xl border border-slate-200 bg-white text-left shadow-sm transition duration-micro ease-out hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1 motion-reduce:transition-none motion-reduce:hover:translate-y-0 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-brand-500/60 dark:focus-visible:ring-offset-slate-900';

export function SlotCategoryCard({
  title,
  count,
  palette,
  index,
  cascade,
  onOpen,
}: {
  title: SlotCategory;
  count: number;
  palette: PlanPalette;
  // Its place in the grid, for the cascade on opening.
  index: number;
  cascade: boolean;
  onOpen: () => void;
}) {
  const info = SLOT_CATEGORY_INFO[title];
  return (
    <button
      type="button"
      data-category-id={title}
      aria-label={`${title}, ${count} ${count === 1 ? 'choice' : 'choices'}`}
      onClick={onOpen}
      className={`${PICK_CARD} gap-2 p-2 ${cascade ? 'animate-card-rise stagger-enter' : ''}`}
      style={cascade ? ({ '--stagger-i': index } as CSSProperties) : undefined}
    >
      {/* The slot's own picture, at three quarters: what the category holds, as it will look. */}
      <span aria-hidden className="pointer-events-none block h-[72px] overflow-hidden rounded-lg">
        <span className="block w-[133.333%] origin-top-left scale-75">
          {info?.picture(palette)}
        </span>
      </span>
      <span className="flex min-w-0 items-center gap-1.5 px-0.5">
        <span
          aria-hidden
          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-brand-50 text-brand-700 transition group-hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:group-hover:bg-brand-500/25"
        >
          {info?.icon}
        </span>
        <span className="min-w-0 flex-1 text-[13px] font-semibold leading-tight text-slate-800 group-hover:text-brand-800 dark:text-slate-100 dark:group-hover:text-brand-200">
          {title}
        </span>
        <CountBadge count={count} />
      </span>
      {info ? (
        <span className="px-0.5 pb-0.5 text-[11.5px] leading-snug text-slate-500 dark:text-slate-400">
          {info.description}
        </span>
      ) : null}
    </button>
  );
}
