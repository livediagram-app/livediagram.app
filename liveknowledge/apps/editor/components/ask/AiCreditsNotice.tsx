'use client';

// Built-in AI on AI credits, with Pro on (docs/specs/030-knowledgebase/tiers.md "Built-in AI on AI credits"): the
// quiet line, and the notice that takes its place when the owner's month is used. Add a Key is an Editor's (AI
// Settings); Upgrade to Pro follows the shared rules (the owner or a team admin, Ask an Admin for a team's member);
// anyone else reads the plain fact. Nothing with Pro off.
import { AI_CREDIT_COSTS, TIER_LIMITS, isOwnerScope } from '@liveworkspace/subscription';
import { useOwnerView, useUpgrade } from '@liveworkspace/subscription-ui';
import { Callout } from '@liveworkspace/ui/callout';
import { creditsLine, creditsUsedSentence } from '@/lib/knowledge-credits';
import { useAiCredits } from '@/lib/use-ai-credits';
import { useOpenKnowledgeTier } from '@/lib/use-knowledge-tier';

/** The quiet line on built-in AI with Pro on, saying what the operation costs before it starts; null with Pro off,
 *  where the caller says what it says today. */
export function useAiCreditsLine(
  documentId: string | null | undefined,
  operation: 'knowledgeAsk' | 'knowledgeSetup' = 'knowledgeAsk',
): string | null {
  const tier = useOpenKnowledgeTier();
  const credits = useAiCredits(documentId);
  return tier ? creditsLine(credits, AI_CREDIT_COSTS[operation]) : null;
}

/** The owner's month is used, with Pro on: the notice takes the quiet line's place, so the line goes. */
export function useAiCreditsUsedUp(documentId: string | null | undefined): boolean {
  const tier = useOpenKnowledgeTier();
  const credits = useAiCredits(documentId);
  return !!tier && !!credits?.usedUp;
}

export function AiCreditsNotice({
  documentId,
  doing,
  onAddKey,
}: {
  documentId: string | null | undefined;
  doing: 'ask' | 'set up';
  // AI Settings, for an Editor; absent for anyone who cannot add a key.
  onAddKey?: (() => void) | undefined;
}) {
  const tier = useOpenKnowledgeTier();
  const credits = useAiCredits(documentId);
  const owner = useOwnerView(isOwnerScope(tier?.owner) ? tier.owner : null);
  const upgrade = useUpgrade();
  if (!tier || !credits?.usedUp) return null;
  const action = owner.status === 'ready' ? owner.view.action : 'none';
  const target = isOwnerScope(tier.owner)
    ? { owner: tier.owner, limit: 'aiCreditsPerMonth' as const }
    : undefined;
  const mayAct = action === 'upgrade' || action === 'ask_admin' || onAddKey !== undefined;
  const offer =
    action === 'upgrade' && target
      ? { label: 'Upgrade to Pro', onSelect: () => upgrade.openUpgrade(target) }
      : action === 'ask_admin' && target
        ? { label: 'Ask an Admin', onSelect: () => upgrade.openAskAdmin(target) }
        : null;
  const addKey = onAddKey ? { label: 'Add a Key', onSelect: onAddKey } : null;
  // The notice's button is the offer, else Add a Key; with both, Add a Key follows the sentence that names it.
  const action_ = offer ?? addKey;
  return (
    <div data-ai-credits-used="">
      <Callout tone="warning" role="status" {...(action_ ? { action: action_ } : {})}>
        {creditsUsedSentence(mayAct, doing, TIER_LIMITS.pro.aiCreditsPerMonth)}
        {offer && addKey ? (
          <>
            {' '}
            <button
              type="button"
              onClick={addKey.onSelect}
              className="cursor-pointer font-semibold underline underline-offset-2 hover:no-underline"
            >
              Add a Key
            </button>
          </>
        ) : null}
      </Callout>
    </div>
  );
}
