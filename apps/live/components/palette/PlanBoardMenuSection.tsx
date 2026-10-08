'use client';

// A Plan board's settings (docs/specs/026-plan/plan-board.md "The board set-up"), in four sections shown as one panel
// by its element menu (its Board flyout) and its own cog, a collapsible each: **Board Title**, **Board Swimlanes**
// (built in or by a field, in one grid), **Supported Cards** (the card types it shows and takes) and **Card Layout**
// (the card size; what a card shows is its type's Display). A column's own settings sit on the column, behind its
// cog. Each change is one element edit, through PlanContext.
import { useState, type ComponentProps, type ReactNode } from 'react';
import type { ShapeElement } from '@livediagram/document';
import {
  CARD_SIZES,
  boardAddTypes,
  normaliseBoardSetup,
  type CardSize,
  type PlanBoardSetup,
} from '@livediagram/items';
import { ChevronDownIcon, PlanCardsIcon, PlanIcon, TextInput, lucideGlyph } from '@livediagram/ui';
import { lucideLayoutGrid, lucideRows2 } from '@livediagram/icons/lucide';
import { MenuTile, MenuTileGrid } from '@/components/primitives/MenuTiles';
import { MenuFlyoutSection } from '@/components/primitives/MenuFlyoutSection';
import { usePlan } from '@/components/plan/PlanContext';
import { CardSizeArt } from '@/components/plan/plan-tile-art';
import { MenuGroup, SwimlaneTiles, TypeToggleTiles } from './plan-menu-parts';
import { trackSetup } from '@/components/plan/track-board-setup';

type FlyoutProps = Omit<ComponentProps<typeof MenuFlyoutSection>, 'title' | 'icon' | 'children'>;

const SIZE_LABELS: Record<CardSize, string> = {
  minimal: 'Minimal',
  compact: 'Compact',
  detailed: 'Detailed',
};

function useBoard(element: ShapeElement) {
  const plan = usePlan();
  const setup = normaliseBoardSetup(element.planBoard);
  if (!plan || !setup || !plan.canEdit) return null;
  const set = (next: PlanBoardSetup, part: string) => {
    plan.updateBoard(element.id, next);
    trackSetup(part);
  };
  return { setup, set };
}

// The Board section: its title. (A board is added to the slides from its own ⋯ menu.)
export function PlanBoardSettings({ element }: { element: ShapeElement }) {
  const board = useBoard(element);
  const [title, setTitle] = useState(board?.setup.title ?? '');
  if (!board) return null;
  const { setup, set } = board;
  return (
    <MenuGroup title="Title">
      <div className="px-3 pb-2 pt-1">
        <TextInput
          compact
          aria-label="Board title"
          className="w-full"
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          onBlur={() => {
            const t = title.trim();
            if (t && t !== setup.title) set({ ...setup, title: t }, 'Title');
            else setTitle(setup.title);
          }}
        />
      </div>
    </MenuGroup>
  );
}

// The Board Swimlanes section: built in, then any field the document's types offer (docs/specs/026-plan/plan-board.md
// "Swimlanes by a field"), in one grid: a board has one grouping.
export function PlanSwimlaneSettings({ element }: { element: ShapeElement }) {
  const board = useBoard(element);
  const plan = usePlan();
  if (!board) return null;
  const { setup, set } = board;
  return (
    <MenuGroup
      title="Group Rows By"
      hint="Rows across the board, one for each value of the field you pick."
    >
      <SwimlaneTiles
        by={setup.swimlaneBy}
        field={setup.swimlaneField}
        types={plan?.types ? boardAddTypes(setup, plan.types) : []}
        allTypes={plan?.types ?? []}
        onPick={(by, field) => {
          const { swimlaneField: _drop, ...rest } = setup;
          set(
            field ? { ...rest, swimlaneBy: by, swimlaneField: field } : { ...rest, swimlaneBy: by },
            'Swimlanes',
          );
        }}
      />
    </MenuGroup>
  );
}

// The Supported Cards section: the card types the board shows and lets you add (none on an Archive board, which
// holds every type it archives).
export function PlanSupportedCardsSettings({ element }: { element: ShapeElement }) {
  const board = useBoard(element);
  const plan = usePlan();
  if (!board || !plan?.types || board.setup.archive) return null;
  const { setup, set } = board;
  // What the board shows and takes now (every type when its named ones were all deleted).
  const allowed = boardAddTypes(setup, plan.types).map((x) => x.id);
  return (
    <MenuGroup title="Card Types" hint="The card types this board shows and lets you add.">
      <TypeToggleTiles
        types={plan.types}
        selected={allowed}
        allowNone
        onChange={(next) => {
          const every = plan.types.every((x) => next.includes(x.id));
          const { addTypes: _drop, ...rest } = setup;
          set(every ? rest : { ...rest, addTypes: next }, 'AddTypes');
        }}
      />
    </MenuGroup>
  );
}

// The Card Layout section: the card size (what a card shows at each size is its type's Display).
export function PlanCardLayoutSettings({ element }: { element: ShapeElement }) {
  const board = useBoard(element);
  if (!board) return null;
  const { setup, set } = board;
  return (
    <MenuGroup
      title="Card Size"
      hint="How much of each card shows. Each card type’s Display sets what shows at each size."
    >
      <MenuTileGrid cols={3}>
        {CARD_SIZES.map((z) => (
          <MenuTile
            key={z}
            icon={<CardSizeArt size={z} />}
            label={SIZE_LABELS[z]}
            active={(setup.cardSize ?? 'detailed') === z}
            onClick={() => {
              const { cardSize: _drop, ...rest } = setup;
              set(z === 'detailed' ? rest : { ...rest, cardSize: z }, 'CardSize');
            }}
          />
        ))}
      </MenuTileGrid>
    </MenuGroup>
  );
}

const RowsIcon = lucideGlyph(lucideRows2, 16);
const LayoutIcon = lucideGlyph(lucideLayoutGrid, 16);

// The four sections, in order, for the element menu and the cog alike. `shows` leaves one out where it has nothing
// (Supported Cards on an Archive board).
export const PLAN_BOARD_SECTIONS: readonly {
  id: 'board-title' | 'swimlanes' | 'supported-cards' | 'card-layout';
  title: string;
  icon: ReactNode;
  Body: (props: { element: ShapeElement }) => ReactNode;
  shows: (setup: PlanBoardSetup) => boolean;
}[] = [
  {
    id: 'board-title',
    title: 'Board Title',
    icon: <PlanIcon size={16} />,
    Body: PlanBoardSettings,
    shows: () => true,
  },
  {
    id: 'swimlanes',
    title: 'Board Swimlanes',
    icon: <RowsIcon />,
    Body: PlanSwimlaneSettings,
    shows: () => true,
  },
  {
    id: 'supported-cards',
    title: 'Supported Cards',
    icon: <PlanCardsIcon size={16} />,
    Body: PlanSupportedCardsSettings,
    shows: (setup) => !setup.archive,
  },
  {
    id: 'card-layout',
    title: 'Card Layout',
    icon: <LayoutIcon />,
    Body: PlanCardLayoutSettings,
    shows: () => true,
  },
];

// The four sections as one panel, each a collapsible group, one open at a time (Board Title when it opens): the
// element menu's Board flyout and the board's own cog both show this.
export function PlanBoardSectionsPanel({ element }: { element: ShapeElement }) {
  const [open, setOpen] = useState<string | null>('board-title');
  const setup = normaliseBoardSetup(element.planBoard);
  return (
    <>
      {PLAN_BOARD_SECTIONS.filter((x) => !setup || x.shows(setup)).map(
        ({ id, title, icon, Body }) => (
          <BoardSettingsSection
            key={id}
            title={title}
            icon={icon}
            open={open === id}
            onToggle={() => setOpen(open === id ? null : id)}
          >
            <Body element={element} />
          </BoardSettingsSection>
        ),
      )}
    </>
  );
}

// A board's settings in its element menu: one Board flyout, beside Style, holding the four sections.
export function PlanBoardMenuSections({
  element,
  flyoutProps,
}: {
  element: ShapeElement;
  flyoutProps: (id: string) => FlyoutProps;
}) {
  if (!useBoard(element)) return null;
  return (
    // One surface of settings, so a flyout row the menu keeps collapsible, never promoted inline.
    <MenuFlyoutSection
      title="Board"
      icon={<PlanIcon size={16} />}
      panel
      {...flyoutProps('plan-board')}
    >
      <div className="flex flex-col py-1">
        <PlanBoardSectionsPanel element={element} />
      </div>
    </MenuFlyoutSection>
  );
}

// One collapsible group of the panel.
function BoardSettingsSection({
  title,
  icon,
  open,
  onToggle,
  children,
}: {
  title: string;
  icon: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  return (
    <section className="border-b border-slate-100 last:border-b-0 dark:border-slate-800">
      <button
        type="button"
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 transition hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800/60"
        onClick={onToggle}
      >
        <span className="text-slate-400 dark:text-slate-400">{icon}</span>
        <span className="flex-1">{title}</span>
        <ChevronDownIcon
          className={`transition-transform duration-short motion-reduce:transition-none ${open ? '' : '-rotate-90'}`}
        />
      </button>
      {/* Animated open and shut, as the menu's accordions are; shut, it leaves the focus order and the tree. */}
      <div
        inert={!open}
        aria-hidden={!open || undefined}
        className={`grid transition-all duration-short ease-out motion-reduce:transition-none ${
          open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
        }`}
      >
        <div className="overflow-hidden">
          <div className="pb-1">{children}</div>
        </div>
      </div>
    </section>
  );
}
