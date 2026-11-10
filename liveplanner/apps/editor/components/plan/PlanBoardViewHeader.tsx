'use client';

// A Plan board's header (PlanBoardView.tsx): a slot board's compact one, or the board's own with its widgets, chips
// and controls (docs/specs/026-plan/plan-board.md "What the board shows").
import { track } from '@/lib/telemetry';
import { typeStatusRefusal } from '@/hooks/plan/status-refusal';
import { trackSetup } from './track-board-setup';
import { BoardSettingsButton } from './BoardSettingsButton';
import { SlotBoardCog } from './SlotBoardCog';
import { PlanBoardHeader } from './PlanBoardHeader';
import { SlotBoardHeader } from './SlotBoardHeader';
import { BoardCardTypeChips } from './BoardCardTypeChips';
import { chipsShown } from './card-type-chips';
import { MaximisePlanButton } from './MaximisedPlanLayer';
import { FocusElementButton } from './FocusElementButton';
import type { PlanBoardViewValues } from './plan-board-view-values';

export function planBoardViewHeader(v: PlanBoardViewValues) {
  const {
    simplified,
    setup,
    shownItems,
    palette,
    plan,
    interactive,
    element,
    slot,
    projection,
    types,
    selected,
    maximised,
    filled,
    setUpHere,
    look,
    quick,
    setQuick,
    self,
    items,
    statusNames,
    canEditCards,
    phone,
    addTypes,
    columnName,
    configuredFromCluster,
    canEdit,
  } = v;
  return simplified ? (
    <SlotBoardHeader
      title={setup.title}
      count={shownItems.length}
      palette={palette}
      loadFailed={plan?.status === 'error'}
      onRetry={() => plan?.retry()}
      controls={
        interactive ? (
          <>
            <MaximisePlanButton id={element.id} maximised={false} palette={palette} />
            {/* The slot's own cog (slot-menu.ts): the board is set up on its tab. */}
            {slot ? slot.cog : null}
          </>
        ) : null
      }
    />
  ) : (
    <PlanBoardHeader
      setup={setup}
      projection={projection}
      items={shownItems}
      types={types}
      palette={palette}
      selected={selected}
      movable={!maximised && !filled}
      canRename={setUpHere && interactive}
      onOpenItem={(id) => plan?.openItem(id)}
      onSetup={(next, part) => {
        plan?.updateBoard(element.id, next);
        trackSetup(part);
      }}
      showWidgets={look.widgets}
      onWidgets={(next) => {
        plan?.updateBoard(element.id, { ...setup, widgets: next });
        trackSetup('Widgets');
      }}
      quick={quick}
      onQuick={setQuick}
      canFilterMine={self?.id ?? null}
      planItems={items}
      {...(statusNames ? { statusNames } : {})}
      canEdit={setUpHere}
      loadFailed={plan?.status === 'error'}
      onRetry={() => plan?.retry()}
      onReveal={() => {
        plan?.updateBoard(element.id, { ...setup, hideWriting: false });
        plan?.announce('Every card turned face up');
        track('Plan', 'Revealed', 'Board');
      }}
      chips={
        chipsShown({ interactive, canEditCards, phone, simplified, setup, types: addTypes }) ? (
          <BoardCardTypeChips
            setup={setup}
            projection={projection}
            types={addTypes}
            palette={palette}
          />
        ) : undefined
      }
      onMoveUnplaced={(item, status) => {
        if (!plan) return;
        const refused = typeStatusRefusal(plan.types, item.type, status, columnName);
        if (refused) plan.announce(refused);
        else plan.moveItem(item.id, { status, before: null });
      }}
      end={
        // Nothing at the header's end on a Board tab an Editor configures from the cluster: no Focus or
        // Maximise (it fills its tab) and no cog (Configure), so no hairline is left standing before it.
        interactive && !(filled && configuredFromCluster) ? (
          <>
            {/* Focus glides the view to fit the board; not while it fills the view. */}
            {maximised || filled ? null : (
              <FocusElementButton bounds={element} kind="Board" palette={palette} />
            )}
            {filled ? null : (
              <MaximisePlanButton id={element.id} maximised={maximised} palette={palette} />
            )}
            {/* The cog last, at the header's far right: the board's one menu (its element menu). In a Dashboard
                  slot, the slot's own cog (slot-menu.ts), the board set up on its tab; maximised from the slot, an
                  Editor's Board Settings with the slot's section after the board's. */}
            {slot ? (
              setUpHere ? (
                <SlotBoardCog element={element} palette={palette} slot={slot} />
              ) : (
                slot.cog
              )
            ) : canEdit && !configuredFromCluster ? (
              <BoardSettingsButton element={element} palette={palette} />
            ) : null}
          </>
        ) : null
      }
    />
  );
}
