'use client';

// A Plan board's settings in its element menu (docs/specs/025-plan/plan-board.md "The board set-up"):
// two flyouts beside Style. **Board**: its title and its rows. **Cards**: what each card face shows, a
// tile per field, pressed on or off. A column's own settings sit on the column, behind its cog. Each
// change is one element edit, through PlanContext.
import { useState, type ComponentProps } from 'react';
import type { ShapeElement } from '@livediagram/document';
import {
  CARD_FIELDS,
  CARD_SIZE_FIELDS,
  CARD_SIZES,
  SWIMLANE_BY,
  normaliseBoardSetup,
  type CardField,
  type CardSize,
  type PlanBoardSetup,
  type SwimlaneBy,
} from '@livediagram/items';
import { PlanCardsIcon, PlanIcon } from '@livediagram/ui';
import { MenuTile, MenuTileGrid } from '@/components/primitives/MenuTiles';
import { MenuFlyoutSection } from '@/components/primitives/MenuFlyoutSection';
import { usePlan } from '@/components/plan/PlanContext';
import { PlanTypeGlyph } from '@/components/plan/plan-type-glyph';
import { CardSizeArt } from '@/components/plan/plan-tile-art';
import { CARD_FIELD_LABELS, SWIMLANE_LABELS } from '@/components/plan/board-setup-edits';
import { trackSetup } from '@/components/plan/track-board-setup';

type FlyoutProps = Omit<ComponentProps<typeof MenuFlyoutSection>, 'title' | 'icon' | 'children'>;

const fieldClass =
  'w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';
const captionClass = 'px-3 pt-2 text-[10px] font-medium text-slate-500 dark:text-slate-400';

// A glyph per row grouping and per card field, from the Plan glyph set.
const ROW_GLYPHS: Record<SwimlaneBy, string> = {
  none: 'item',
  assignee: 'person',
  type: 'task',
  priority: 'flag',
  parent: 'project',
  status: 'action',
};
const FIELD_GLYPHS: Record<CardField, string> = {
  key: 'bookmark',
  type: 'task',
  assignee: 'person',
  priority: 'flag',
  labels: 'bookmark',
  estimate: 'cube',
  due: 'calendar',
  votes: 'star',
  checklist: 'action',
  description: 'note',
  parent: 'project',
};

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

export function PlanBoardMenuSection({
  element,
  flyoutProps,
}: {
  element: ShapeElement;
  flyoutProps: FlyoutProps;
}) {
  const board = useBoard(element);
  const [title, setTitle] = useState(board?.setup.title ?? '');
  if (!board) return null;
  const { setup, set } = board;
  return (
    <MenuFlyoutSection title="Board" icon={<PlanIcon size={16} />} {...flyoutProps}>
      <div className="px-3 pt-1">
        <label className="text-[10px] font-medium text-slate-500 dark:text-slate-400">
          Title
          <input
            className={`${fieldClass} mt-1`}
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
        </label>
      </div>
      <p className={captionClass}>Swimlanes</p>
      <MenuTileGrid cols={3}>
        {SWIMLANE_BY.map((s) => (
          <MenuTile
            key={s}
            icon={<PlanTypeGlyph glyph={ROW_GLYPHS[s]} size={16} />}
            label={SWIMLANE_LABELS[s]}
            active={setup.swimlaneBy === s}
            onClick={() => set({ ...setup, swimlaneBy: s }, 'Swimlanes')}
          />
        ))}
      </MenuTileGrid>
    </MenuFlyoutSection>
  );
}

export function PlanCardsMenuSection({
  element,
  flyoutProps,
}: {
  element: ShapeElement;
  flyoutProps: FlyoutProps;
}) {
  const board = useBoard(element);
  if (!board) return null;
  const { setup, set } = board;
  // The fields this card size can draw; the rest stay set but dimmed (docs/specs/025-plan/plan-board.md).
  const sizeFields = CARD_SIZE_FIELDS[setup.cardSize ?? 'detailed'];
  const toggle = (f: CardField) =>
    set(
      {
        ...setup,
        cardFields: setup.cardFields.includes(f)
          ? setup.cardFields.filter((x) => x !== f)
          : CARD_FIELDS.filter((x) => x === f || setup.cardFields.includes(x)),
      },
      'CardFields',
    );
  return (
    <MenuFlyoutSection title="Cards" icon={<PlanCardsIcon size={16} />} {...flyoutProps}>
      <p className={captionClass}>Card Size</p>
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
      <p className={captionClass}>
        {setup.cardSize === 'minimal'
          ? 'Minimal cards show their title only'
          : setup.cardSize === 'compact'
            ? 'What each card shows under its title (Detailed shows the rest)'
            : 'What each card shows, besides its title'}
      </p>
      <MenuTileGrid cols={3}>
        {CARD_FIELDS.map((f) => (
          <MenuTile
            key={f}
            icon={
              f === 'key' ? (
                <span className="text-[13px] font-semibold leading-none">#</span>
              ) : (
                <PlanTypeGlyph glyph={FIELD_GLYPHS[f]} size={16} />
              )
            }
            label={CARD_FIELD_LABELS[f]}
            active={setup.cardFields.includes(f) && sizeFields.includes(f)}
            disabled={!sizeFields.includes(f)}
            onClick={() => toggle(f)}
          />
        ))}
      </MenuTileGrid>
    </MenuFlyoutSection>
  );
}
