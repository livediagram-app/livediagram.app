'use client';

// The Automations glyphs (docs/specs/026-plan/automations.md "Where it shows"): the lightning bolt that stands for
// Automation everywhere (the footer button, the screen's badge, a card's history and comments), and each step's icon
// on its tinted tile: the trigger in the brand violet, conditions in orange, actions in blue, as the design draws them.

import type { AutomationActionKind, AutomationStep } from '@liveplanner/items';
import { lucideGlyph } from '@liveplanner/ui';
import {
  lucideFunnel,
  lucideGitFork,
  lucideFlag,
  lucideMail,
  lucideMessageSquare,
  lucideMoveRight,
  lucideEraser,
  lucidePackage,
  lucidePencil,
  lucideSquarePlus,
  lucideTag,
  lucideUser,
  lucideZap,
} from '@liveworkspace/icons/lucide';

export const BoltIcon = lucideGlyph(lucideZap, 16);
export const ConditionIcon = lucideGlyph(lucideFunnel, 16);

type Glyph = ReturnType<typeof lucideGlyph>;

const ACTION_GLYPHS: Record<AutomationActionKind | 'if', Glyph> = {
  move: lucideGlyph(lucideMoveRight, 16),
  set_field: lucideGlyph(lucidePencil, 16),
  clear_field: lucideGlyph(lucideEraser, 16),
  assign: lucideGlyph(lucideUser, 16),
  add_label: lucideGlyph(lucideTag, 16),
  remove_label: lucideGlyph(lucideTag, 16),
  comment: lucideGlyph(lucideMessageSquare, 16),
  flag: lucideGlyph(lucideFlag, 16),
  unflag: lucideGlyph(lucideFlag, 16),
  archive: lucideGlyph(lucidePackage, 16),
  create_card: lucideGlyph(lucideSquarePlus, 16),
  email: lucideGlyph(lucideMail, 16),
  if: lucideGlyph(lucideGitFork, 16),
};

export type StepTone = 'trigger' | 'condition' | 'action';

// The tile behind a step's icon, and the colour of its kind label ("When", "If all of these", "Then").
export const STEP_TILE: Record<StepTone, string> = {
  trigger: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
  condition: 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  action: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
};
export const STEP_KIND_TEXT: Record<StepTone, string> = {
  trigger: 'text-brand-700 dark:text-brand-300',
  condition: 'text-orange-700 dark:text-orange-300',
  action: 'text-blue-700 dark:text-blue-300',
};

/** A step's icon on its tile: the bolt for the trigger, the funnel for conditions, the action's own. */
export function StepTile({
  tone,
  kind,
  size = 32,
}: {
  tone: StepTone;
  kind?: AutomationStep['kind'];
  size?: 24 | 32;
}) {
  const Icon =
    tone === 'trigger'
      ? BoltIcon
      : tone === 'condition'
        ? ConditionIcon
        : ACTION_GLYPHS[kind ?? 'move'];
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center ${size === 32 ? 'size-8 rounded-lg' : 'size-6 rounded-md'} ${STEP_TILE[tone]}`}
    >
      <Icon size={size === 32 ? 16 : 13} aria-hidden />
    </span>
  );
}

/** Automation's own disc: the bolt on violet, where a person's initials would be (history, comments, previews). */
export function AutomationDisc({
  size = 24,
  ringed = false,
}: {
  size?: 24 | 28;
  ringed?: boolean;
}) {
  return (
    <span
      aria-hidden
      data-automation-disc=""
      className={`relative z-[1] inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 text-brand-700 dark:bg-brand-500/25 dark:text-brand-200 ${size === 24 ? 'size-6' : 'size-7'} ${ringed ? 'ring-[3px] ring-white dark:ring-slate-900' : ''}`}
    >
      <BoltIcon size={size === 24 ? 12 : 14} aria-hidden />
    </span>
  );
}
