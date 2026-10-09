'use client';

// Setup Board's third step, Layout (docs/specs/026-plan/plan-board.md "Setup Board"): the board's Swimlanes and Card
// Size, with the same tiles as its menu's Swimlanes and Card Layout, then Fill Tab with its warning. It starts from
// the board as it is, so it can be skipped.
import type { ItemTypeDef } from '@livediagram/items';
import { CardSizeOptions, SwimlaneOptions } from '@/components/palette/plan-menu-parts';
import type { PlanPalette } from './plan-palette';
import type { SetupLayout } from './setup-board';
import { SetupFillTabOption } from './SetupFillTabOption';

const HEADING = 'text-[11px] font-semibold uppercase tracking-wider';

export function SetupLayoutStep({
  layout,
  types,
  allTypes,
  others,
  saving,
  palette,
  onChange,
}: {
  layout: SetupLayout;
  // The card types chosen in step 1 (what the swimlanes can group by), and every type of the document.
  types: readonly ItemTypeDef[];
  allTypes: readonly ItemTypeDef[];
  // The other elements on the tab: what Fill Tab would delete.
  others: number;
  // Run again on a board that has columns (Save Board).
  saving: boolean;
  palette: PlanPalette;
  onChange: (next: SetupLayout) => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-[13px]" style={{ color: palette.muted }}>
        How the board is laid out. It starts as the board is now; every choice can change later from
        its cog.
      </p>
      <section className="flex flex-col gap-1.5" aria-labelledby="setup-swimlanes">
        <h3 id="setup-swimlanes" className={HEADING} style={{ color: palette.muted }}>
          Swimlanes
        </h3>
        <p className="text-[12px]" style={{ color: palette.muted }}>
          Rows across the board, one for each value of the field you pick.
        </p>
        <div>
          <SwimlaneOptions
            noStatus
            palette={palette}
            by={layout.swimlaneBy}
            field={layout.swimlaneField}
            types={types}
            allTypes={allTypes}
            onPick={(swimlaneBy, swimlaneField) =>
              onChange({ ...layout, swimlaneBy, swimlaneField })
            }
          />
        </div>
      </section>
      <section className="flex flex-col gap-1.5" aria-labelledby="setup-card-size">
        <h3 id="setup-card-size" className={HEADING} style={{ color: palette.muted }}>
          Card Display
        </h3>
        <p className="text-[12px]" style={{ color: palette.muted }}>
          How much of each card shows. Each card type’s Display sets what shows at each size.
        </p>
        <div>
          <CardSizeOptions
            palette={palette}
            size={layout.cardSize}
            onPick={(cardSize) => onChange({ ...layout, cardSize })}
          />
        </div>
      </section>
      <SetupFillTabOption
        on={layout.fillTab}
        others={others}
        saving={saving}
        palette={palette}
        onChange={(fillTab) => onChange({ ...layout, fillTab })}
      />
    </div>
  );
}
