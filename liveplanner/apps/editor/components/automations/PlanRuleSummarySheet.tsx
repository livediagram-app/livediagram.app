'use client';

// A rule as a Participant or a Viewer reads it (docs/specs/026-plan/automations.md "On cards"): the platform's sheet
// with the little of liveplanner it reads. Its routes, its words, each card action's icon and the editor's own
// clock; never the screen's kit, so a reader's chunk carries no builder. Loaded on first open (AutomationAuthor).

import type { AutomationStep } from '@liveplanner/items';
import {
  RuleSummarySheet,
  type RuleSummaryKit,
} from '@liveworkspace/automations-ui/RuleSummarySheet';
import { useRelativeNow } from '@/lib/relative-time';
import type { ItemsScope } from '@/lib/api/items';
import { glyphOf } from './automation-glyphs';
import { PLAN_AUTOMATIONS_CLIENT } from './plan-client';

const KIT: RuleSummaryKit = {
  client: PLAN_AUTOMATIONS_CLIENT,
  item: 'plan',
  goneNote: 'What it did to this card stays in its Activity.',
  picksLabel: 'For Cards Where',
  glyph: (line) => glyphOf(line.kind as AutomationStep['kind'], line.via),
  useNow: useRelativeNow,
};

export function PlanRuleSummarySheet({
  scope,
  ruleId,
  name,
  onClose,
}: {
  // A reader's door: the card's thread scope (a tab link's tab rides along), else the plan's.
  scope: Pick<ItemsScope, 'ownerId' | 'projectId' | 'shareCode'> & { tabId?: string | null };
  ruleId?: string | undefined;
  name: string;
  onClose: () => void;
}) {
  const { ownerId, projectId, shareCode, tabId } = scope;
  return (
    <RuleSummarySheet
      kit={KIT}
      scope={{ ownerId, itemId: projectId, shareCode, tabId: tabId ?? null }}
      ruleId={ruleId}
      name={name}
      onClose={onClose}
    />
  );
}
