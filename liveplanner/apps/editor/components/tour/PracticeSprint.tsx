'use client';

// The Boards track of the Plan tour, the Practice Sprint (docs/specs/026-plan/plan-tour.md "Boards: Practice
// Sprint"): three practice cards dealt onto the person's own board, on this screen alone (practice-items.ts), and
// missions that tick off as they move one on, open one, date one and ship one. The board is the real board: every
// drag, menu and key works as ever. When it ends the practice cards go, unless the person keeps them.

import { useEffect, useMemo, useState } from 'react';
import { newItemId, typeIn, type Item } from '@liveplanner/items';
import { Button } from '@liveplanner/ui';
import { useEditorContext } from '@/app/project/[id]/EditorContext';
import { practiceShipColumn } from '@/components/plan/PracticeMarks';
import { useIsMobileViewport } from '@liveworkspace/workbench/hooks/ui/useIsMobileViewport';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { track } from '@/lib/telemetry';
import { MissionStrip } from './MissionStrip';
import { useMissions } from './missions';
import {
  boardRoot,
  FINISH_STEP,
  needsReveal,
  overWipColumn,
  PRACTICE_CARD_TITLES,
  planTourStepTelemetryType,
  sprintMissions,
  type SprintCtx,
  type SprintShape,
  wipNote,
} from './plan-tour-steps';
import { LearnMore } from './LearnMore';

// How long the page carries the deal's mark (canvas-motion.css practice-deal): the last card's drop, and a margin.
const DEAL_MS = 900;
const NO_ITEMS: readonly Item[] = [];

export type SprintEnd = { outcome: 'completed' | 'skipped'; kept: boolean };

export function PracticeSprint({
  boardId,
  onEnd,
}: {
  boardId: string;
  onEnd: (end: SprintEnd) => void;
}) {
  const ctx = useEditorContext();
  const phone = useIsMobileViewport();
  const plan = ctx.plan;
  const element = ctx.activeTab.elements.find((e) => e.id === boardId);
  const setup = element && 'planBoard' in element ? element.planBoard : undefined;

  // The board's shape, fixed as the sprint starts: missions never change under the person.
  const [shape] = useState<SprintShape | null>(() => {
    const columns = setup?.columns ?? [];
    const first = columns[0];
    const ship = setup ? practiceShipColumn(setup) : undefined;
    if (!first || !ship) return null;
    const next = columns[1] ?? first;
    const typeId = setup?.addTypes?.[0] ?? 'task';
    return {
      boardId,
      firstStatus: first.status,
      nextStatus: next.status,
      nextName: next.name,
      shipStatus: ship.status,
      shipName: ship.name,
      hasDue: typeIn(plan.context.types, typeId).fields.includes('due'),
      phone,
    };
  });
  const missions = useMemo(() => (shape ? sprintMissions(shape) : []), [shape]);

  // The deal: three practice cards into the first column, dropping in one after another.
  const endPractice = plan.endPractice;
  // Read when it runs: the deal happens once as the sprint mounts (a remount, as Strict Mode's, ends the first
  // practice and deals again).
  const deal = useLatest(() => {
    if (!shape || !setup) return undefined;
    if (needsReveal(boardRoot(boardId)) && element && 'width' in element && 'height' in element)
      ctx.scrollIntoView(element.x, element.y, element.width, element.height);
    const root = document.documentElement;
    root.setAttribute('data-practice-deal', '');
    const ok = plan.practise(
      PRACTICE_CARD_TITLES.map((title) => ({
        id: newItemId(),
        type: setup.addTypes?.[0] ?? 'task',
        fields: { title },
        place: { status: shape.firstStatus },
      })),
    );
    if (!ok) debugLog('[plan-tour] practice cards refused');
    const t = window.setTimeout(() => root.removeAttribute('data-practice-deal'), DEAL_MS);
    return () => {
      window.clearTimeout(t);
      root.removeAttribute('data-practice-deal');
    };
  });
  useEffect(() => deal.current(), [deal]);
  // However the sprint goes away, the practice cards go with it (a kept set has already become real).
  const endRef = useLatest(endPractice);
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
  const live: SprintCtx | null = shape ? { ...shape, practice, openItemId: plan.openItemId } : null;
  const run = useMissions({
    missions,
    ctx: live as SprintCtx,
    active: live !== null,
    onView: (m) => track('UI', 'View', planTourStepTelemetryType(m.id)),
  });
  useEffect(() => {
    if (run.phase === 'finish') track('UI', 'View', planTourStepTelemetryType(FINISH_STEP.id));
  }, [run.phase]);

  // A WIP limit gone over during the sprint: said once, on the mission it happened in (plan-tour.md "WIP limits").
  const [wip, setWip] = useState<{ missionId: string; note: string } | null>(null);
  const over = setup && run.mission ? overWipColumn(setup.columns, items.values()) : null;
  const missionId = run.mission?.id ?? null;
  if (over && missionId && !wip) setWip({ missionId, note: wipNote(over) });

  // Nothing to practise on (a board with no columns): the sprint ends as it starts.
  useEffect(() => {
    if (!shape) onEnd({ outcome: 'skipped', kept: false });
  }, [shape, onEnd]);
  if (!shape) return null;

  const finish = (keep: boolean) => {
    if (keep) track('UI', 'Selected', 'PlanTourKeepCards');
    void endPractice(keep);
    onEnd({ outcome: 'completed', kept: keep });
  };

  return (
    <MissionStrip
      name="Practice Sprint"
      run={run}
      note={wip && wip.missionId === missionId ? wip.note : null}
      onEnd={() => onEnd({ outcome: 'skipped', kept: false })}
      finish={
        <div className="flex flex-col gap-3">
          <div>
            <h3 className="text-[15px] font-semibold leading-tight text-slate-900 dark:text-white">
              Sprint done.
            </h3>
            <p className="mt-1 text-[13px] leading-snug text-slate-600 dark:text-slate-300">
              Keep the practice cards as real ones, or clear them and start on your own.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => finish(false)}>
              Clear Them
            </Button>
            <Button variant="secondary" size="sm" onClick={() => finish(true)}>
              Keep as Real Cards
            </Button>
            <span className="flex-1" />
            <LearnMore href="/help/plan/planning-basics/" />
          </div>
        </div>
      }
    />
  );
}
