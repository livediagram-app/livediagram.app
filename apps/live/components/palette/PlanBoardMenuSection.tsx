'use client';

// A Plan board's settings in its element menu (docs/specs/026-plan/plan-board.md "The board set-up"):
// two flyouts beside Style. **Board**: its title (with Add to Slides beside it) and its swimlanes, built in or by a
// field, in one grid. **Cards**: the types new cards can be and the card size (what a card shows is its type's Display). Each group sits under a heading, a hairline apart. A column's own settings sit on the column, behind its cog. Each
// change is one element edit, through PlanContext.
import { useState, type ComponentProps } from 'react';
import type { ShapeElement } from '@livediagram/document';
import {
  CARD_SIZES,
  boardAddTypes,
  normaliseBoardSetup,
  type CardSize,
  type PlanBoardSetup,
} from '@livediagram/items';
import { PlanCardsIcon, PlanIcon, TextInput } from '@livediagram/ui';
import { MenuTile, MenuTileGrid, MenuToolButton } from '@/components/primitives/MenuTiles';
import { SlideDeckIcon } from '@/components/palette/palette-icons';
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

// The Board settings in its element menu's flyout; the same settings open from the board's own cog.
export function PlanBoardMenuSection({
  element,
  flyoutProps,
}: {
  element: ShapeElement;
  flyoutProps: FlyoutProps;
}) {
  if (!useBoard(element)) return null;
  return (
    // One surface of settings, so a flyout row the menu keeps collapsible, never promoted inline.
    <MenuFlyoutSection title="Board" icon={<PlanIcon size={16} />} panel {...flyoutProps}>
      <PlanBoardSettings element={element} />
    </MenuFlyoutSection>
  );
}

// The Board settings themselves: its title (with Add to Slides) and its swimlanes.
export function PlanBoardSettings({ element }: { element: ShapeElement }) {
  const board = useBoard(element);
  const plan = usePlan();
  const [title, setTitle] = useState(board?.setup.title ?? '');
  if (!board) return null;
  const { setup, set } = board;
  const addSlide = plan?.addBoardSlide;
  return (
    <>
      <MenuGroup title="Title">
        <div className="flex items-center gap-1 px-3 pb-2 pt-1">
          <TextInput
            compact
            aria-label="Board title"
            className="min-w-0 flex-1"
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
          {addSlide ? (
            <MenuToolButton
              icon={<SlideDeckIcon />}
              label="Add to Slides"
              description="Adds this board to the deck as a slide"
              onClick={() => {
                addSlide(element.id);
                plan?.announce('Board added to the slides');
              }}
            />
          ) : null}
        </div>
      </MenuGroup>
      {/* Built in, then any field the document's types offer (docs/specs/026-plan/plan-board.md "Swimlanes by a
          field"), in one grid: a board has one grouping. */}
      <MenuGroup
        title="Swimlanes"
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
              field
                ? { ...rest, swimlaneBy: by, swimlaneField: field }
                : { ...rest, swimlaneBy: by },
              'Swimlanes',
            );
          }}
        />
      </MenuGroup>
    </>
  );
}

// The Cards settings in its element menu's flyout; the same settings open from the board's own cog.
export function PlanCardsMenuSection({
  element,
  flyoutProps,
}: {
  element: ShapeElement;
  flyoutProps: FlyoutProps;
}) {
  if (!useBoard(element)) return null;
  return (
    <MenuFlyoutSection title="Cards" icon={<PlanCardsIcon size={16} />} panel {...flyoutProps}>
      <PlanCardsSettings element={element} />
    </MenuFlyoutSection>
  );
}

// The Cards settings themselves: the types it takes, the card size and what a card shows.
export function PlanCardsSettings({ element }: { element: ShapeElement }) {
  const board = useBoard(element);
  const plan = usePlan();
  if (!board) return null;
  const { setup, set } = board;
  // What the board shows and takes now (every type when its named ones were all deleted).
  const allowedTypes = plan?.types ? boardAddTypes(setup, plan.types) : [];
  const allowed = allowedTypes.map((x) => x.id);
  return (
    <>
      {setup.archive || !plan ? null : (
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
      )}
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
    </>
  );
}
