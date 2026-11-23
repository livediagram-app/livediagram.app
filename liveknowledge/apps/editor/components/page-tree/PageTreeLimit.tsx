'use client';

// Knowledgebase Pages at the page tree's foot (docs/specs/030-knowledgebase/tiers.md "Knowledgebase Pages"): from 80%
// of what bounds the open knowledgebase, the shared meter; at it, the shared notice under it. The bound is the owner's
// pages over every knowledgebase they own, to the owner or the owning team ("You have 500 pages, the most Free holds
// across your Knowledgebases.", with Upgrade to Pro, or Ask an Admin for a team's member), or the knowledgebase's fixed
// bound ("This Knowledgebase holds 500 pages, the most one can.", no offer). Nothing with Pro off.
import { pageCount, type TreePage } from '@liveknowledge/document';
import { TIER_LIMITS, isOwnerScope } from '@liveworkspace/subscription';
import { Callout } from '@liveworkspace/ui/callout';
import { LimitNotice, NEAR_LIMIT, UsageMeter, useOwnerView } from '@liveworkspace/subscription-ui';
import { fullSentence, pagesTierOf } from '@/lib/knowledge-import/import-trim';
import { useOpenKnowledgeTier } from '@/lib/use-knowledge-tier';
import { usePagesBound } from '@/lib/use-pages-bound';

const count = (n: number) => n.toLocaleString('en-US');

export function PageTreeLimit({ tabs }: { tabs: readonly TreePage[] }) {
  const tier = useOpenKnowledgeTier();
  const used = pageCount(tabs);
  const bound = usePagesBound(used);
  const owner = useOwnerView(isOwnerScope(tier?.owner) ? tier.owner : null);
  if (!tier || !bound) return null;
  const { account } = bound;
  // The owner's figure counts every knowledgebase of theirs; the bound's alone counts this one.
  const meterUsed = account ? account.limit - (bound.max - used) : used;
  const meterMax = account ? account.limit : bound.max;
  if (meterUsed < meterMax * NEAR_LIMIT) return null;
  const limitKey = 'knowledgebasePages' as const;
  return (
    <div data-page-tree-limit="" className="flex flex-col gap-2 pb-2">
      <UsageMeter
        limitKey={limitKey}
        label={account ? 'Knowledgebase Pages' : 'Pages'}
        used={meterUsed}
        limit={meterMax}
        // Stacked: the sidebar is too narrow for "Knowledgebase Pages" beside a bar.
        layout="stacked"
        words={`${count(meterUsed)} of ${count(meterMax)}`}
      />
      {used >= bound.max && account ? (
        <LimitNotice
          limitKey={limitKey}
          used={meterUsed}
          limit={meterMax}
          owner={owner}
          near={false}
          sentence={fullSentence(bound)}
          offer={
            pagesTierOf(account.limit) === 'free' && account.whose === 'yours'
              ? `Pro holds ${count(TIER_LIMITS.pro.knowledgebasePages)}.`
              : ''
          }
        />
      ) : null}
      {/* The fixed bound is the same on every tier: no offer. */}
      {used >= bound.max && !account ? (
        <Callout tone="warning" role="status">
          {fullSentence(bound)}
        </Callout>
      ) : null}
    </div>
  );
}
