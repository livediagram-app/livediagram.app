import type { StartCategory } from '@/components/plan/start/start-planning-items';
import type { ReactNode } from 'react';
import type { OverviewModel } from './overview-model';
import { OverviewActivity } from './OverviewActivity';
import { OverviewCardTypes } from './OverviewCardTypes';
import { OverviewHeader } from './OverviewHeader';
import type { TabTileSummary } from './overview-tabs';
import { OverviewBand } from './OverviewSection';
import { OverviewTabs } from './OverviewTabs';
import { useOverviewEntrance } from './useOverviewEntrance';
import type { OverviewSurface } from './overview-style';

// What the session may do from the Overview (docs/specs/026-plan/plan-overview.md "Share roles"), worked out by the
// page from `can`; each false leaves its control out.
export type OverviewAbilities = {
  // Rename and describe the plan in place (whoever may edit the whole plan).
  editPlan: boolean;
  addTab: boolean;
  editTypes: boolean;
  addType: boolean;
};

export type OverviewActions = {
  openTab: (tabId: string) => void;
  // `start` opens the new tab's Start Planning on that kind (the Add Tab tile's chips).
  addTab: (start?: StartCategory) => void;
  editType: (typeId: string) => void;
  // A card type tile's quick actions (plan-overview.md "Card Types").
  addField: (typeId: string) => void;
  addCard: (typeId: string) => void;
  addTypeToBoard: (typeId: string, boardElementId: string) => void;
  addType: () => void;
  openCard: (itemId: string) => void;
  rename: (name: string) => void;
  describe: (description: string) => void;
};

// The Overview's page, drawn from what it is handed (the page component reads the editor; tests hand it plainly).
export function OverviewView({
  name,
  description,
  dates,
  datesTitle,
  model,
  preview,
  now,
  may,
  actions,
  surface,
}: {
  name: string;
  description: string;
  dates: string | null;
  datesTitle?: string | undefined;
  model: OverviewModel;
  // A tab tile's preview (the page's TabPreview; tests hand anything).
  preview: (tile: TabTileSummary) => ReactNode;
  now: number;
  may: OverviewAbilities;
  actions: OverviewActions;
  // The Overview's style as the page wears it (overview-style.ts): its backdrop, font and type scale, and the app's
  // light or dark pairs that match the backdrop. Absent, the app's own surface.
  surface?: OverviewSurface | undefined;
}) {
  // While it opens, its content rises in (globals.css "The Plan Overview's entrance").
  const entering = useOverviewEntrance();
  return (
    <div
      role="region"
      aria-label="Plan Overview"
      data-plan-overview=""
      data-overview-entering={entering ? '' : undefined}
      // `dark` / `light` set the scheme for everything inside, whatever the viewer's chrome (theme.css's variant).
      className={`h-full overflow-y-auto overscroll-contain bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 ${surface?.scheme ?? ''}`}
      style={surface?.style}
    >
      <OverviewHeader
        name={name}
        description={description}
        dates={dates}
        datesTitle={datesTitle}
        people={model.people}
        onRename={may.editPlan ? actions.rename : undefined}
        onDescribe={may.editPlan ? actions.describe : undefined}
        paint={surface?.header}
      />
      {/* The sections as alternating bands (plan-overview.md "Bands"): plain, washed, plain below lg; from lg Recent
          Activity is a side panel the content's full height. The last band keeps room for the dock ("The dock") and
          the phone's home indicator. */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-w-0 flex-col">
          <OverviewBand tone="plain">
            <OverviewTabs
              tiles={model.tabTiles}
              preview={preview}
              onOpenTab={actions.openTab}
              onAddTab={may.addTab ? actions.addTab : undefined}
            />
          </OverviewBand>
          <OverviewBand tone="wash" foot="lg">
            <OverviewCardTypes
              tiles={model.cardTypes}
              {...(surface?.scheme === 'dark' ? { scheme: 'dark' as const } : {})}
              onOpenTab={actions.openTab}
              onEditType={may.editTypes ? actions.editType : undefined}
              onAddField={may.editTypes ? actions.addField : undefined}
              onAddCard={may.editTypes ? actions.addCard : undefined}
              onAddToBoard={may.editTypes ? actions.addTypeToBoard : undefined}
              onAddType={may.editTypes && may.addType ? actions.addType : undefined}
            />
          </OverviewBand>
        </div>
        <OverviewBand tone="panel" foot="always">
          <OverviewActivity
            entries={model.activity}
            cardTypes={model.cardTypes}
            now={now}
            onOpenCard={actions.openCard}
          />
        </OverviewBand>
      </div>
    </div>
  );
}
