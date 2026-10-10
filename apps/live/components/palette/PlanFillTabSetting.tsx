'use client';

// Fill Tab in a board's Board Setup section (docs/specs/026-plan/plan-board.md "Fill Tab"): two rows, On Canvas and
// Fill Tab. Turning it on deletes everything else on the tab's canvas, so when there is anything a confirm says how
// much first; the deletion and the setting are one change (PlanContext.fillTab), one undo step.
import type { PlanBoardSetup } from '@livediagram/items';
import { OptionRows } from '@/components/plan/OptionRows';
import { usePlan } from '@/components/plan/PlanContext';
import { FillTabArt } from '@/components/plan/plan-tile-art';
import { fillTabConfirm, withFillTab } from '@/components/plan/fill-tab';
import { useConfirm } from '@/hooks/ui/useConfirm';
import { trackFillTab } from '@/components/plan/track-board-setup';
import { MenuGroup } from './plan-menu-parts';

export const FILL_TAB_HINT =
  'The board always fills this tab, so the rest of the canvas can’t be used.';

export function PlanFillTabSetting({
  boardId,
  setup,
  onClose,
}: {
  boardId: string;
  setup: PlanBoardSetup;
  // Closes the menu or sheet holding it before the confirm opens, so the confirm is never drawn under it (a phone's
  // settings sheet sits above dialogs).
  onClose?: (() => void) | undefined;
}) {
  const plan = usePlan();
  const confirm = useConfirm();
  if (!plan?.canEdit) return null;
  const on = setup.fillTab === true;
  const turnOff = () => {
    if (!on) return;
    trackFillTab(false);
    plan.updateBoard(boardId, withFillTab(setup, false));
  };
  const turnOn = async () => {
    if (on) return;
    const others = plan.tabOthers(boardId);
    if (others.count > 0) {
      onClose?.();
      if (!(await confirm(fillTabConfirm(setup.title, others)))) return;
    }
    trackFillTab(true);
    // From the board as it is when the change is made, not as it was when the confirm opened.
    plan.fillTab(boardId, (current) => withFillTab(current, true));
  };
  return (
    <MenuGroup title="Fill Tab" hint={FILL_TAB_HINT}>
      <OptionRows
        kind="single"
        label="Fill Tab"
        className="mx-3 my-1.5"
        selected={on ? 'fill' : 'canvas'}
        rows={[
          { id: 'canvas', label: 'On Canvas', icon: <FillTabArt fill={false} /> },
          { id: 'fill', label: 'Fill Tab', icon: <FillTabArt fill /> },
        ]}
        onPick={(id) => (id === 'fill' ? void turnOn() : turnOff())}
      />
    </MenuGroup>
  );
}
