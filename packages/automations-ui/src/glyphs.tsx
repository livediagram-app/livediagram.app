'use client';

// The Automations glyphs (liveworkspace/docs/specs/018-automations/automations.md; blueprint ui.md "Glyphs"): the
// lightning bolt that stands for Automation everywhere (the footer's row, the screen's badge, what a rule did), and
// each step's icon on its tinted tile: the trigger and actions in the app's brand tint, conditions in orange. An app's
// own actions bring their icon in the kit (kinds.actions[key].glyph); the steps every app has are drawn here.
// Imports nothing of the screen: the footer's row reads the bolt from here.

import type { AutomationKind, AutomationVia } from '@liveworkspace/automations';
import { lucideGlyph } from '@liveworkspace/ui';
import {
  lucideClock,
  lucideFunnel,
  lucideGitFork,
  lucideHash,
  lucideHourglass,
  lucideUsers,
  lucideWebhook,
  lucideZap,
} from '@liveworkspace/icons/lucide';
import type { AnyAutomationsKit, GlyphType } from './kit';
import { stepKey } from './types';

export const BoltIcon = lucideGlyph(lucideZap, 16);
export const ConditionIcon = lucideGlyph(lucideFunnel, 16);
// A time trigger's own: the clock, where any other trigger has the bolt.
export const ClockIcon = lucideGlyph(lucideClock, 16);
export const IfGlyph = lucideGlyph(lucideGitFork, 16);
export const WaitGlyph = lucideGlyph(lucideHourglass, 16);

// A message step by where it posts: your own service, a Slack channel, a Teams channel.
export const NOTIFY_GLYPHS: Record<AutomationVia, GlyphType> = {
  webhook: lucideGlyph(lucideWebhook, 16),
  slack: lucideGlyph(lucideHash, 16),
  teams: lucideGlyph(lucideUsers, 16),
};

export type StepTone = 'trigger' | 'condition' | 'action';

// The tile behind a step's icon, and the colour of its kind label ("When", "If all of these", "Then").
export const STEP_TILE: Record<StepTone, string> = {
  trigger: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
  condition: 'bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300',
  action: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300',
};
export const STEP_KIND_TEXT: Record<StepTone, string> = {
  trigger: 'text-brand-700 dark:text-brand-300',
  condition: 'text-orange-700 dark:text-orange-300',
  action: 'text-brand-700 dark:text-brand-300',
};

/** The icon of an action's tile, by its key (types.ts stepKey): an If / Else's fork, the app's branch's, the kit's
 *  own for each of its actions; the bolt for a key the kit lacks (a kind since retired). */
export function actionGlyph(kit: AnyAutomationsKit, key: string): GlyphType {
  if (key === 'if') return IfGlyph;
  if (kit.kinds.branch && key === kit.kinds.branch.kind) return kit.kinds.branch.glyph;
  return kit.kinds.actions[key]?.glyph ?? BoltIcon;
}

export const stepGlyph = (kit: AnyAutomationsKit, step: AutomationKind): GlyphType =>
  actionGlyph(kit, stepKey(step));

/** A step's icon on its tile: the bolt for the trigger (a clock for a time), the funnel for conditions, and `glyph`
 *  for an action. */
export function StepTile({
  tone,
  glyph,
  time = false,
  size = 32,
}: {
  tone: StepTone;
  glyph?: GlyphType | undefined;
  time?: boolean;
  size?: 24 | 32;
}) {
  const Icon =
    tone === 'trigger'
      ? time
        ? ClockIcon
        : BoltIcon
      : tone === 'condition'
        ? ConditionIcon
        : (glyph ?? BoltIcon);
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center ${size === 32 ? 'size-8 rounded-lg' : 'size-6 rounded-md'} ${STEP_TILE[tone]}`}
    >
      <Icon size={size === 32 ? 16 : 13} aria-hidden />
    </span>
  );
}

/** Automation's own disc: the bolt on the brand tint, where a person's initials would be (history, comments,
 *  previews). */
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
