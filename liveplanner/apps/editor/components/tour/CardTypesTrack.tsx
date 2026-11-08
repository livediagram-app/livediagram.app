'use client';

// A board's Card Types track (docs/specs/026-plan/plan-tour.md "Boards: Card Types"): make a card type, give it a
// field, and add a card of it to the board, through the plan's own Types panel and editor. The type is real (the plan
// stores it); the card added is a practice card, gone at the end. The finish keeps the type or puts it back.

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Item, PlanBoardSetup } from '@liveplanner/items';
import { useEditorContext } from '@/app/project/[id]/EditorContext';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { helpArticleHref } from '@/lib/help-articles';
import { track } from '@/lib/telemetry';
import { newTypeOf, typeShape, typesMissions, type TypesCtx } from './board-tracks';
import { LearnMore } from './LearnMore';
import { MissionStrip } from './MissionStrip';
import { useMissions } from './missions';
import { planTourStepTelemetryType } from './plan-tour-steps';
import { TrackFinish } from './TrackFinish';

const NO_ITEMS: readonly Item[] = [];

export function CardTypesTrack({
  boardId,
  onEnd,
}: {
  boardId: string;
  onEnd: (outcome: 'completed' | 'skipped') => void;
}) {
  const ctx = useEditorContext();
  const plan = ctx.plan;
  const types = plan.context.types;
  const element = ctx.activeTab.elements.find((e) => e.id === boardId);
  const setup = element && 'planBoard' in element ? (element.planBoard as PlanBoardSetup) : null;
  // The plan's types and the board as the track started.
  const [startIds] = useState<ReadonlySet<string>>(() => new Set(types.map((t) => t.id)));
  const [startSetup] = useState(setup);
  const firstColumn = startSetup?.columns[0];
  const missions = useMemo(
    () => typesMissions(boardId, firstColumn?.name ?? 'the first column'),
    [boardId, firstColumn?.name],
  );

  // The new type, and its fields as first seen (set as it renders, so an edit is told apart).
  const made = newTypeOf({ startIds, types });
  const [first, setFirst] = useState<{ id: string; shape: string } | null>(null);
  if (made && first?.id !== made.id) setFirst({ id: made.id, shape: typeShape(made) });

  // A card of the new type added on this board is a practice card (plan-tour.md "Add a Card"); a board that names its
  // types takes the new one too, so its Add card offers it.
  const madeId = made?.id ?? null;
  const statuses = useMemo(
    () => new Set((startSetup?.columns ?? []).map((c) => c.status)),
    [startSetup],
  );
  const capture = plan.capturePractice;
  useEffect(() => {
    if (!madeId) return;
    capture(
      (c) =>
        c.type === madeId && typeof c.place?.status === 'string' && statuses.has(c.place.status),
    );
  }, [madeId, statuses, capture]);
  const setupRef = useLatest(setup);
  const updateBoard = plan.context.updateBoard;
  // Once per new type: the board's setup may not show the first write yet when this runs again.
  const addedRef = useRef<string | null>(null);
  useEffect(() => {
    const now = setupRef.current;
    if (!madeId || addedRef.current === madeId || !now?.addTypes || now.addTypes.includes(madeId))
      return;
    addedRef.current = madeId;
    updateBoard(boardId, { ...now, addTypes: [...now.addTypes, madeId] });
  }, [madeId, boardId, updateBoard, setupRef]);
  // However the track goes away, its practice card goes too, and new cards are real again.
  const endRef = useLatest(plan.endPractice);
  useEffect(() => () => void endRef.current(false), [endRef]);

  const items = plan.context.items;
  const practice = useMemo(
    () =>
      plan.practiceIds.size === 0
        ? NO_ITEMS
        : [...plan.practiceIds].flatMap((id) => {
            const item = items.get(id);
            return item ? [item] : [];
          }),
    [items, plan.practiceIds],
  );
  const live: TypesCtx = {
    startIds,
    types,
    firstShape: first && made && first.id === made.id ? first.shape : null,
    practice,
  };
  const run = useMissions({
    missions,
    ctx: live,
    active: startSetup !== null,
    onView: (m) => track('UI', 'View', planTourStepTelemetryType(m.id)),
  });
  if (!startSetup) return null;

  const finish = (keep: boolean) => {
    void plan.endPractice(false);
    if (!keep) {
      track('UI', 'Selected', 'PlanTourPutBack');
      if (madeId) plan.context.itemTypes.deleteType(madeId);
      const now = setupRef.current;
      if (now && JSON.stringify(now.addTypes) !== JSON.stringify(startSetup.addTypes))
        plan.context.updateBoard(boardId, { ...now, addTypes: startSetup.addTypes });
    }
    onEnd('completed');
  };
  return (
    <MissionStrip
      name="Card Types"
      run={run}
      onEnd={() => onEnd('skipped')}
      finish={
        <TrackFinish
          heading={made ? `${made.label} is ready.` : 'Types done.'}
          line="Keep your new type for real cards, or put the plan back as it was."
          keepLabel="Keep the Type"
          onKeep={() => finish(true)}
          onPutBack={() => finish(false)}
          learnMore={<LearnMore href={helpArticleHref('planCardTypes')} />}
        />
      }
    />
  );
}
