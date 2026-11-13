'use client';

// Describe a Plan in the editor (docs/specs/026-plan/describe-a-plan.md; blueprint describe-a-plan.md "Editor"): the
// dialog bound to this plan. Who is asking (signed in, or a guest who sees the nudge), the plan's card types and the
// statuses its boards name (what the preview checks against), and Make Plan: the types the plan lacks added as one
// change, then the board placed as Start Planning places one, filling this tab. Loaded with its own chunk when chosen.

import { useEffect, useMemo } from 'react';
import {
  ITEM_TYPE_CATALOGUE_VERSION,
  planFromDraft,
  planOutline,
  type PlanDraft,
  type PlanDraftPlan,
} from '@liveplanner/items';
import { useEditorContext } from '@/app/project/[id]/EditorContext';
import { authHrefWithReturn } from '@/components/chrome/auth-shared';
import { track } from '@/lib/telemetry';
import { DescribePlanDialog } from './DescribePlanDialog';
import { draftPlan } from './plan-draft-client';

// Make Plan's words when the plan's cards or types are not there to make it with.
export const DESCRIBE_PLAN_NOT_READY = 'This plan isn’t ready yet. Try again in a moment.';

export function DescribePlanHost({ onClose }: { onClose: () => void }) {
  const ctx = useEditorContext();
  const plan = ctx.plan?.context;
  const types = plan?.types;
  const stored = plan?.itemTypes.catalogue;
  // The plan as the draft would join it: its catalogue (the types it shows, where none are stored yet) and the
  // statuses every board names, so a column named as one of them takes it.
  const context = useMemo<PlanDraftPlan>(() => {
    const catalogue =
      stored ??
      (types?.length ? { version: ITEM_TYPE_CATALOGUE_VERSION, types: [...types] } : null);
    return { catalogue, statuses: planOutline(ctx.tabs, catalogue).statuses };
  }, [stored, types, ctx.tabs]);

  useEffect(() => {
    track('UI', 'Opened', 'PlanDescribe');
  }, []);

  const make = (draft: PlanDraft): string | null => {
    if (!plan) return DESCRIBE_PLAN_NOT_READY;
    const made = planFromDraft(draft, context);
    if (!made.ok) return made.message;
    // The types first, so the board finds them when it lands and brings none of its own.
    if (made.newTypes.length > 0) plan.itemTypes.addTypes(made.newTypes);
    const c = ctx.getViewportCenter();
    ctx.planTabs.startElementTab('board', () =>
      ctx.dropPaletteItem('plan-board', c.x, c.y, { planBoard: made.setup }),
    );
    track('Plan', 'Created', 'PlanDraft');
    onClose();
    return null;
  };

  return (
    <DescribePlanDialog
      signedIn={!!ctx.accountUserId}
      // Back to this very plan and tab once signed in.
      signInHref={authHrefWithReturn(
        '/sign-in/',
        `${window.location.pathname}${window.location.search}${window.location.hash}`,
      )}
      draft={(prompt) => draftPlan(ctx.selfParticipant.id, prompt)}
      plan={context}
      planTypes={context.catalogue?.types ?? []}
      onMake={make}
      onClose={onClose}
    />
  );
}
