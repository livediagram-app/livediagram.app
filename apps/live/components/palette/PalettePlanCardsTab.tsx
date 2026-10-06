'use client';

// The palette's Cards category (docs/specs/026-plan/item-types.md "Where types show"): card tiles
// drawn from the document's item types, so a type someone adds shows here and a renamed or deleted
// one changes or goes. Outside the editor (no PlanContext) the built-in types stand.
import { ITEM_TYPES } from '@livediagram/items';
import { usePlan } from '@/components/plan/PlanContext';
import { PaletteTileGrid } from './PaletteTileGrid';
import { planCardTile } from './palette-plan-tiles';
import { openCardTypes } from '@/hooks/plan/card-types-opener';
import { track } from '@/lib/telemetry';

type GridProps = Omit<React.ComponentProps<typeof PaletteTileGrid>, 'tiles'>;

export function PalettePlanCardsTab(props: GridProps) {
  const plan = usePlan();
  const types = plan?.types ?? ITEM_TYPES;
  return (
    <>
      <PaletteTileGrid {...props} tiles={types.map(planCardTile)} />
      {/* Edit Cards: the Card Types panel, where types are added and their fields set
          (docs/specs/026-plan/item-types.md "The Card Types panel"). */}
      {plan?.canEdit ? (
        <div className="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
          <button
            type="button"
            className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-[12px] font-medium text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:text-white"
            onClick={() => {
              track('Plan', 'Opened', 'EditCards');
              openCardTypes();
            }}
          >
            Edit Cards
          </button>
        </div>
      ) : null}
    </>
  );
}
