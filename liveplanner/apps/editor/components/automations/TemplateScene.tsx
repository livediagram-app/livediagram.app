'use client';

// Each template tile's living preview (docs/specs/026-plan/automations.md "The Automations screen": Templates): a
// small board moment that rests just before the rule acts and plays on hover. The motion is the classes in
// app/automation-scenes.css; the parts are scene-parts.tsx; the scenes are in template-scenes/. Decoration only: the
// whole scene is aria-hidden.

import type { ReactNode } from 'react';
import type { AutomationTemplateId } from '@liveplanner/items';
import { TONES, type SceneTone, type ToneClasses } from './scene-parts';
import {
  StampFinish,
  AssignOnStart,
  OverdueNudge,
  FormResponses,
  ShippedToSlack,
  TriageBugs,
  UnblockNext,
  DueSoon,
} from './template-scenes/first';
import {
  CleanUpDone,
  EscalateUrgent,
  ReopenOnComment,
  RouteReviews,
  DueOnStart,
  FlagBlocked,
  VerifyFix,
  BackToBacklog,
  SortIncoming,
  SummariseRequests,
} from './template-scenes/board';
import { CloseParent, TellUnblocked, NudgeStuck, DoneWhenResolved } from './template-scenes/linked';

export type { SceneTone } from './scene-parts';

const SCENES: Readonly<Record<AutomationTemplateId, (p: { tone: ToneClasses }) => ReactNode>> = {
  'stamp-finish': StampFinish,
  'assign-on-start': AssignOnStart,
  'overdue-nudge': OverdueNudge,
  'form-responses': FormResponses,
  'shipped-to-slack': ShippedToSlack,
  'triage-bugs': TriageBugs,
  'unblock-next': UnblockNext,
  'due-soon': DueSoon,
  'clean-up-done': CleanUpDone,
  'escalate-urgent': EscalateUrgent,
  'reopen-on-comment': ReopenOnComment,
  'route-reviews': RouteReviews,
  'due-on-start': DueOnStart,
  'flag-blocked': FlagBlocked,
  'verify-fix': VerifyFix,
  'back-to-backlog': BackToBacklog,
  'sort-incoming': SortIncoming,
  'summarise-requests': SummariseRequests,
  'close-parent': CloseParent,
  'tell-unblocked': TellUnblocked,
  'nudge-stuck': NudgeStuck,
  'done-when-resolved': DoneWhenResolved,
};

/** The scene at the top of a template tile, in the template's colour. */
export function TemplateScene({ id, tone }: { id: AutomationTemplateId; tone: SceneTone }) {
  const t = TONES[tone];
  const Scene = SCENES[id];
  return (
    <span
      aria-hidden
      className={`relative flex h-[116px] shrink-0 gap-2 overflow-hidden border-b border-slate-100 bg-gradient-to-br p-3 dark:border-slate-800 ${t.wash}`}
    >
      <span
        className={`pointer-events-none absolute inset-0 ${t.dots}`}
        style={{
          backgroundImage: 'radial-gradient(currentColor 1px, transparent 1.2px)',
          backgroundSize: '10px 10px',
          maskImage: 'linear-gradient(115deg, transparent 20%, #000 95%)',
          WebkitMaskImage: 'linear-gradient(115deg, transparent 20%, #000 95%)',
        }}
      />
      <Scene tone={t} />
    </span>
  );
}
