import type { OverviewModel } from './overview-model';
import { OverviewActivity } from './OverviewActivity';
import { OverviewCardTypes } from './OverviewCardTypes';
import { OverviewHeader } from './OverviewHeader';
import { OverviewTabs } from './OverviewTabs';

// What the session may do from the Overview (docs/specs/026-plan/plan-overview.md "Share roles"), worked out by the
// page from `can`; each false leaves its control out.
export type OverviewAbilities = {
  editDetails: boolean;
  addTab: boolean;
  editTypes: boolean;
  addType: boolean;
  share: boolean;
};

export type OverviewActions = {
  openTab: (tabId: string) => void;
  addTab: () => void;
  editType: (typeId: string) => void;
  addType: () => void;
  openCard: (itemId: string) => void;
  editDetails: () => void;
  share: () => void;
};

// The Overview's page, drawn from what it is handed (the page component reads the editor; tests hand it plainly).
export function OverviewView({
  name,
  description,
  dates,
  datesTitle,
  model,
  now,
  may,
  actions,
}: {
  name: string;
  description: string;
  dates: string | null;
  datesTitle?: string | undefined;
  model: OverviewModel;
  now: number;
  may: OverviewAbilities;
  actions: OverviewActions;
}) {
  return (
    <div
      role="region"
      aria-label="Plan Overview"
      data-plan-overview=""
      className="h-full overflow-y-auto overscroll-contain bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100"
    >
      <OverviewHeader
        name={name}
        description={description}
        dates={dates}
        datesTitle={datesTitle}
        people={model.people}
        onEditDetails={may.editDetails ? actions.editDetails : undefined}
        onShare={may.share ? actions.share : undefined}
      />
      {/* Bottom padding clears the phone's home indicator. */}
      <div className="grid gap-8 px-4 pb-[calc(2rem+env(safe-area-inset-bottom))] pt-6 sm:px-10 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="flex min-w-0 flex-col gap-7">
          <OverviewTabs
            tiles={model.tabTiles}
            onOpenTab={actions.openTab}
            onAddTab={may.addTab ? actions.addTab : undefined}
          />
          <OverviewCardTypes
            tiles={model.cardTypes}
            onEditType={may.editTypes ? actions.editType : undefined}
            onAddType={may.editTypes && may.addType ? actions.addType : undefined}
          />
        </div>
        <OverviewActivity entries={model.activity} now={now} onOpenCard={actions.openCard} />
      </div>
    </div>
  );
}
