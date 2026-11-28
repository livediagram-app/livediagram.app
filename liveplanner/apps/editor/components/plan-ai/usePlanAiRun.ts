'use client';

// A Plan AI turn (docs/specs/026-plan/plan-ai.md "A turn"): the open tab read, the instruction and the last few turns
// sent, and the answer's changes made through the tab's own edit paths (plan-ai-host.ts) on the tab as it is when they
// come back. A Viewer's turn changes nothing; Stop drops the answer unread, so nothing changes. The turn's Undo takes
// back as many undo steps as its changes made, and only while it is the newest turn.
import { useCallback, useEffect, useRef } from 'react';
import {
  PLAN_AI_INSTRUCTION_MAX,
  PLAN_AI_TAB_NAME_MAX,
  PLAN_AI_TURNS_MAX,
  PLAN_AI_TURN_REPLY_MAX,
  PLAN_AI_WORDS,
  type PlanAiRole,
} from '@liveplanner/items';
import { DraftRefusal } from '@/components/describe/draft-client';
import { track } from '@/lib/telemetry';
import { askPlanAi } from './plan-ai-client';
import type { PlanAiTab } from './plan-ai-host';
import { droppedLine, NOTHING_APPLIED, replyShown, type PlanAiApplied } from './plan-ai-lines';
import {
  clearPlanAiThread,
  planAiThread,
  startPlanAiTurn,
  updatePlanAiTurn,
} from './plan-ai-thread';

export const PLAN_AI_LOADING = 'This tab is still loading. Try again in a moment.';
export const PLAN_AI_MOVED_ON =
  'The tab changed before the answer came back, so nothing was changed. Ask again.';

export function usePlanAiRun(opts: {
  tabId: string;
  latest: () => PlanAiTab | null;
  role: PlanAiRole;
  ownerId: string;
  projectId: string;
  teamId: string | null;
  builtIn: boolean;
  undo: () => void;
}): {
  ask: (instruction: string) => boolean;
  stop: () => void;
  undo: (turnId: string) => void;
  clear: () => void;
} {
  const live = useRef(opts);
  useEffect(() => {
    live.current = opts;
  });
  const running = useRef<{ tabId: string; turnId: string; abort: AbortController } | null>(null);

  const ask = useCallback((raw: string): boolean => {
    const o = live.current;
    const instruction = raw.trim().slice(0, PLAN_AI_INSTRUCTION_MAX);
    if (!instruction || running.current) return false;
    const host = o.latest();
    if (!host) return false;
    const tabId = host.tabId;
    const turns = planAiThread(tabId)
      .filter((t) => t.status === 'done')
      .slice(-PLAN_AI_TURNS_MAX)
      .map((t) => ({
        instruction: t.instruction,
        reply: t.reply.slice(0, PLAN_AI_TURN_REPLY_MAX),
      }));
    const turnId = startPlanAiTurn(tabId, instruction);
    track('Plan', 'Used', 'PlanAi');
    const read = host.read();
    if (read === null) {
      updatePlanAiTurn(tabId, turnId, {
        status: 'failed',
        failure: { message: PLAN_AI_LOADING, aiKey: null },
      });
      return true;
    }
    const abort = new AbortController();
    running.current = { tabId, turnId, abort };
    void (async () => {
      try {
        const answer = await askPlanAi(
          o.ownerId,
          {
            projectId: o.projectId,
            kind: host.kind,
            tabName: host.tabName.slice(0, PLAN_AI_TAB_NAME_MAX),
            tab: read,
            instruction,
            ...(turns.length ? { turns } : {}),
            ...(o.teamId ? { teamId: o.teamId } : {}),
            ...(o.builtIn ? { ai: 'built-in' as const } : {}),
          },
          abort.signal,
        );
        if (abort.signal.aborted) return;
        let applied: PlanAiApplied = NOTHING_APPLIED;
        const viewer = answer.role === 'view' || live.current.role === 'view';
        if (answer.changes.length && !viewer) {
          const now = live.current.latest();
          applied =
            now && now.tabId === tabId && now.kind === host.kind
              ? await now.apply(answer.changes)
              : { lines: [{ text: PLAN_AI_MOVED_ON, ok: false }], steps: 0 };
          if (applied.steps > 0) track('Plan', 'Changed', 'PlanAiChange');
        }
        // The changes the role may not make: the api's count, and any a Viewer's answer still held.
        const dropped = answer.dropped + (viewer ? answer.changes.length : 0);
        const lines = dropped
          ? [...applied.lines, droppedLine(host.kind, viewer ? 'view' : answer.role, dropped)]
          : applied.lines;
        updatePlanAiTurn(tabId, turnId, {
          status: 'done',
          // Never words that claim a change that wasn't made.
          reply: replyShown(answer.reply, lines),
          lines,
          steps: applied.steps,
          provider: answer.provider,
        });
      } catch (e) {
        if (abort.signal.aborted) return;
        updatePlanAiTurn(tabId, turnId, {
          status: 'failed',
          failure:
            e instanceof DraftRefusal
              ? { message: e.message, aiKey: e.aiKey }
              : { message: PLAN_AI_WORDS.failed, aiKey: null },
        });
      } finally {
        if (running.current?.turnId === turnId) running.current = null;
      }
    })();
    return true;
  }, []);

  const stop = useCallback(() => {
    const run = running.current;
    if (!run) return;
    running.current = null;
    run.abort.abort();
    updatePlanAiTurn(run.tabId, run.turnId, { status: 'stopped' });
  }, []);

  const undo = useCallback((turnId: string) => {
    const { tabId } = live.current;
    const turns = planAiThread(tabId);
    const turn = turns[turns.length - 1];
    if (!turn || turn.id !== turnId || turn.undone || turn.steps === 0) return;
    for (let i = 0; i < turn.steps; i++) live.current.undo();
    updatePlanAiTurn(tabId, turnId, { undone: true });
    track('Plan', 'Undone', 'PlanAiChange');
  }, []);

  const clear = useCallback(() => {
    if (running.current) return;
    clearPlanAiThread(live.current.tabId);
  }, []);

  return { ask, stop, undo, clear };
}
