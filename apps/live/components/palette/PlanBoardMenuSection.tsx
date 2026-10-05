'use client';

// A Plan board's settings in its element menu (docs/specs/025-plan/plan-board.md "The board set-up"): the
// board-wide choices, where every element keeps its own. Title; rows; which card types and label it
// shows; what its cards show; voting and its budget; hidden writing; and Add Column. A column's own
// settings sit on the column, behind its cog. Each change is one element edit, through PlanContext.
import { useState, type ComponentProps } from 'react';
import type { ShapeElement } from '@livediagram/document';
import {
  CARD_FIELDS,
  SWIMLANE_BY,
  normaliseBoardSetup,
  type PlanBoardSetup,
} from '@livediagram/items';
import { PlanIcon } from '@livediagram/ui';
import { MenuTile, MenuTileGrid } from '@/components/primitives/MenuTiles';
import { MenuFlyoutSection } from '@/components/primitives/MenuFlyoutSection';
import { MenuActionRow } from '@/components/primitives/PortalMenu';
import { usePlan } from '@/components/plan/PlanContext';
import {
  CARD_FIELD_LABELS,
  SWIMLANE_LABELS,
  addColumnAfter,
} from '@/components/plan/board-setup-edits';
import { trackSetup } from '@/components/plan/track-board-setup';
import { MenuToggleRow } from './context-menu-input-rows';

const fieldClass =
  'w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-brand-400 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200';
const captionClass = 'px-3 pt-2 text-[10px] font-medium text-slate-500 dark:text-slate-400';

export function PlanBoardMenuSection({
  element,
  flyoutProps,
}: {
  element: ShapeElement;
  // The menu's flyout wiring for this section (useContextMenuScaffold's flyoutProps('plan-board')).
  flyoutProps: Omit<ComponentProps<typeof MenuFlyoutSection>, 'title' | 'icon' | 'children'>;
}) {
  const plan = usePlan();
  const setup = normaliseBoardSetup(element.planBoard);
  const [title, setTitle] = useState(setup?.title ?? '');
  if (!plan || !setup || !plan.canEdit) return null;
  const set = (next: PlanBoardSetup, part: string) => {
    plan.updateBoard(element.id, next);
    trackSetup(part);
  };
  const shown = setup.scope.types;
  const toggleType = (id: string) => {
    const all = plan.types.map((t) => t.id);
    const current = (shown ?? all).filter((t) => all.includes(t));
    const next = current.includes(id) ? current.filter((t) => t !== id) : [...current, id];
    const { types: _old, ...scope } = setup.scope;
    void _old;
    set(
      {
        ...setup,
        scope: next.length === all.length || next.length === 0 ? scope : { ...scope, types: next },
      },
      'Scope',
    );
  };

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
      <p className={captionClass}>Rows</p>
      <MenuTileGrid cols={3}>
        {SWIMLANE_BY.map((s) => (
          <MenuTile
            key={s}
            icon={<PlanIcon size={16} />}
            label={SWIMLANE_LABELS[s]}
            active={setup.swimlaneBy === s}
            onClick={() => set({ ...setup, swimlaneBy: s }, 'Rows')}
          />
        ))}
      </MenuTileGrid>
      <p className={captionClass}>Shows</p>
      {plan.types.map((t) => (
        <MenuToggleRow
          key={t.id}
          label={`${t.label} Cards`}
          checked={!shown?.length || shown.includes(t.id)}
          onToggle={() => toggleType(t.id)}
        />
      ))}
      <p className={captionClass}>Cards Show</p>
      {CARD_FIELDS.map((f) => (
        <MenuToggleRow
          key={f}
          label={CARD_FIELD_LABELS[f]}
          checked={setup.cardFields.includes(f)}
          onToggle={() =>
            set(
              {
                ...setup,
                cardFields: setup.cardFields.includes(f)
                  ? setup.cardFields.filter((x) => x !== f)
                  : CARD_FIELDS.filter((x) => x === f || setup.cardFields.includes(x)),
              },
              'CardFields',
            )
          }
        />
      ))}
      <p className={captionClass}>Together</p>
      <MenuToggleRow
        label="Voting"
        description="Everyone can vote on cards"
        checked={setup.voting.on}
        onToggle={() =>
          set({ ...setup, voting: { ...setup.voting, on: !setup.voting.on } }, 'Voting')
        }
      />
      <MenuToggleRow
        label="Hide Writing"
        description="Cards stay face down until Reveal"
        checked={setup.hideWriting}
        onToggle={() => set({ ...setup, hideWriting: !setup.hideWriting }, 'HideWriting')}
      />
      <MenuActionRow
        label="Add Column"
        icon={<PlanIcon size={16} />}
        disabled={!addColumnAfter(setup, null)}
        onClick={() => {
          const added = addColumnAfter(setup, null);
          if (added) set(added.setup, 'ColumnAdded');
        }}
      />
    </MenuFlyoutSection>
  );
}
