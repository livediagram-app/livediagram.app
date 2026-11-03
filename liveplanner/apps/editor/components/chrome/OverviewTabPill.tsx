import { lucideGlyph } from '@liveplanner/ui';
import { lucideHouse } from '@liveworkspace/icons/lucide';
import { TabFrame } from '@liveworkspace/workbench/components/chrome/TabFrame';

// The Overview's key in the strip: never a tab id (tab ids are uuids), so no tab reads as the open one while it is.
export const OVERVIEW_TAB_KEY = 'overview';

const HomeGlyph = lucideGlyph(lucideHouse, 12);

// The Plan Overview's entry, first in the tab bar (docs/specs/026-plan/plan-overview.md "The tab bar"): drawn by the
// same tab shape as any tab, its home glyph before its name, with no menu, no avatars, no rename and no drag. Then a
// thin divider before the plan's own tabs.
export function OverviewTabPill({ open, onOpen }: { open: boolean; onOpen: () => void }) {
  return (
    <>
      <TabFrame
        id={OVERVIEW_TAB_KEY}
        name="Overview"
        active={open}
        readOnly
        lockIcon={<HomeGlyph />}
        tourId="overview-tab"
        onSelect={onOpen}
      />
      <span
        aria-hidden
        data-overview-divider=""
        className="mx-1 h-5 w-px shrink-0 self-center bg-slate-200 dark:bg-slate-700"
      />
    </>
  );
}
