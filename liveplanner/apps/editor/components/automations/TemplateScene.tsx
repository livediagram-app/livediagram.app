'use client';

// Each template tile's living preview (docs/specs/026-plan/automations.md "The Automations screen": Templates): a
// small board moment that rests just before the rule acts and plays on hover. The motion is the classes in
// app/automation-scenes.css; the parts are scene-parts.tsx; the scenes are in template-scenes/. Decoration only: the
// whole scene is aria-hidden.

import type { ReactNode } from 'react';
import type { AutomationTemplateId } from '@liveplanner/items';
import type { SceneTone, ToneClasses } from '@liveworkspace/automations-ui/scene-parts';
import { TemplateScene as SceneFrame } from '@liveworkspace/automations-ui/TemplateScene';
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
import {
  CloseParent,
  TellUnblocked,
  NudgeStuck,
  DoneWhenResolved,
  DoneOnChecklist,
} from './template-scenes/linked';
import {
  ReviewOnOpen,
  DoneOnMerge,
  FlagFailingChecks,
  TellChecksPass,
  BackOnClose,
  MergedToSlack,
} from './template-scenes/github';
import { ReleaseNote } from './template-scenes/cross-app';

export type { SceneTone } from '@liveworkspace/automations-ui/scene-parts';

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
  'flag-due-soon': FlagBlocked,
  'done-on-checklist': DoneOnChecklist,
  'review-on-open': ReviewOnOpen,
  'done-on-merge': DoneOnMerge,
  'flag-failing-checks': FlagFailingChecks,
  'tell-checks-pass': TellChecksPass,
  'back-on-close': BackOnClose,
  'merged-to-slack': MergedToSlack,
  'release-note': ReleaseNote,
};

// Each template's colour.
const TONE: Readonly<Record<AutomationTemplateId, SceneTone>> = {
  'stamp-finish': 'emerald',
  'assign-on-start': 'blue',
  'overdue-nudge': 'red',
  'form-responses': 'orange',
  'shipped-to-slack': 'violet',
  'triage-bugs': 'red',
  'unblock-next': 'blue',
  'due-soon': 'emerald',
  'clean-up-done': 'emerald',
  'escalate-urgent': 'red',
  'reopen-on-comment': 'blue',
  'route-reviews': 'violet',
  'due-on-start': 'orange',
  'flag-blocked': 'red',
  'verify-fix': 'emerald',
  'back-to-backlog': 'blue',
  'sort-incoming': 'violet',
  'summarise-requests': 'orange',
  'close-parent': 'emerald',
  'tell-unblocked': 'blue',
  'nudge-stuck': 'orange',
  'done-when-resolved': 'violet',
  'flag-due-soon': 'red',
  'done-on-checklist': 'emerald',
  'review-on-open': 'emerald',
  'done-on-merge': 'violet',
  'flag-failing-checks': 'red',
  'tell-checks-pass': 'emerald',
  'back-on-close': 'orange',
  'merged-to-slack': 'violet',
  'release-note': 'blue',
};

/** The scene at the top of a template tile, in the template's colour (`tone`: another colour). */
export function TemplateScene({ id, tone }: { id: AutomationTemplateId; tone?: SceneTone }) {
  return <SceneFrame tone={tone ?? TONE[id]} Scene={SCENES[id]} />;
}
