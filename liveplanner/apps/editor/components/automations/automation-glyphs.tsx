'use client';

// liveplanner's Automations glyphs (docs/specs/026-plan/automations.md "Where it shows"): each card action's icon,
// beside the bolt, the tiles and Automation's disc, which are the platform's
// (@liveworkspace/automations-ui/glyphs). The kit hands each action its icon from here (plan-kit.tsx), and StepTile
// keeps the form this editor's own parts draw it in: by a step's kind, a message step by where it posts.

import type { AutomationActionKind, AutomationStep, AutomationVia } from '@liveplanner/items';
import { SparkleIcon, lucideGlyph } from '@liveplanner/ui';
import {
  lucideAtSign,
  lucideCircleCheck,
  lucideCopyPlus,
  lucideLink,
  lucideListChecks,
  lucidePalette,
  lucideShapes,
  lucideUndo2,
  lucideListTree,
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
} from '@liveworkspace/icons/lucide';
import {
  IfGlyph,
  NOTIFY_GLYPHS,
  StepTile as SharedStepTile,
  WaitGlyph,
  type StepTone,
} from '@liveworkspace/automations-ui/glyphs';
import type { GlyphType } from '@liveworkspace/automations-ui/kit';

export {
  AutomationDisc,
  BoltIcon,
  ClockIcon,
  ConditionIcon,
  NOTIFY_GLYPHS,
  STEP_KIND_TEXT,
  STEP_TILE,
  type StepTone,
} from '@liveworkspace/automations-ui/glyphs';

export const BranchGlyph = lucideGlyph(lucideListTree, 16);

export const ACTION_GLYPHS: Record<AutomationActionKind | 'if' | 'for' | 'wait', GlyphType> = {
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
  set_type: lucideGlyph(lucideShapes, 16),
  set_colour: lucideGlyph(lucidePalette, 16),
  restore: lucideGlyph(lucideUndo2, 16),
  copy_card: lucideGlyph(lucideCopyPlus, 16),
  add_checklist: lucideGlyph(lucideListChecks, 16),
  link_card: lucideGlyph(lucideLink, 16),
  mention: lucideGlyph(lucideAtSign, 16),
  resolve_threads: lucideGlyph(lucideCircleCheck, 16),
  wait: WaitGlyph,
  if: IfGlyph,
  for: BranchGlyph,
};

/** A step's icon by its kind: an outgoing action's by where it posts, the sparkle for an AI action. */
export const glyphOf = (
  kind: AutomationStep['kind'] | undefined,
  via?: AutomationVia,
): GlyphType =>
  kind === 'notify'
    ? NOTIFY_GLYPHS[via ?? 'webhook']
    : kind === 'ai'
      ? SparkleIcon
      : ACTION_GLYPHS[kind ?? 'move'];

/** A step's icon on its tile: the bolt for the trigger (a clock for a time), the funnel for conditions, the action's
 *  own, an outgoing action's by where it posts, and the sparkle for an AI action. */
export function StepTile({
  tone,
  kind,
  via,
  time = false,
  size = 32,
}: {
  tone: StepTone;
  kind?: AutomationStep['kind'] | undefined;
  via?: AutomationVia | undefined;
  time?: boolean;
  size?: 24 | 32;
}) {
  return (
    <SharedStepTile
      tone={tone}
      glyph={tone === 'action' ? glyphOf(kind, via) : undefined}
      time={time}
      size={size}
    />
  );
}
