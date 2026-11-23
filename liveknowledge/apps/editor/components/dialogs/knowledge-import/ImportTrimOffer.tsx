'use client';

// An import over what the knowledgebase may hold, with Pro on (docs/specs/030-knowledgebase/tiers.md "Import over the
// limit"): the amber notice that says how many fit and what is left out, and, where the owner's Knowledgebase Pages
// are what bound it, the offer to upgrade first. Upgrade and Import All is the owner's or a team admin's; a team's
// member is offered Ask an Admin; anyone else, and the per-knowledgebase bound, no offer.
import { isOwnerScope } from '@liveworkspace/subscription';
import { useOwnerView, useUpgrade } from '@liveworkspace/subscription-ui';
import { Callout } from '@liveworkspace/ui/callout';
import {
  fullSentence,
  trimmedToast,
  trimOffer,
  type PagesBound,
} from '@/lib/knowledge-import/import-trim';
import { useOpenKnowledgeTier } from '@/lib/use-knowledge-tier';

/** Who may act on the knowledgebase's tier, and how: the owner view's action, for the open knowledgebase. */
export function usePagesOffer(
  bound: PagesBound | null,
): { label: string; open: () => void } | null {
  const tier = useOpenKnowledgeTier();
  const owner = useOwnerView(isOwnerScope(tier?.owner) ? tier.owner : null);
  const upgrade = useUpgrade();
  if (!tier || !bound?.account || owner.status !== 'ready' || !isOwnerScope(tier.owner))
    return null;
  const target = { owner: tier.owner, limit: 'knowledgebasePages' as const };
  if (owner.view.action === 'upgrade')
    return { label: 'Upgrade and Import All', open: () => upgrade.openUpgrade(target) };
  if (owner.view.action === 'ask_admin')
    return { label: 'Ask an Admin', open: () => upgrade.openAskAdmin(target) };
  return null;
}

export function ImportTrimNotice({
  found,
  room,
  bound,
}: {
  found: number;
  room: number;
  bound: PagesBound;
}) {
  if (room <= 0)
    return (
      <Callout
        tone="warning"
        role="status"
        title={bound.account ? 'Your Pages Are Full' : 'This Knowledgebase Is Full'}
      >
        {fullSentence(bound)}
      </Callout>
    );
  const offer = trimOffer(found, room, bound);
  return (
    <div data-import-trim="">
      <Callout tone="warning" role="status" title={offer.title}>
        {offer.detail}
      </Callout>
    </div>
  );
}

/** The finished import's note when pages were left out: what was imported, and Upgrade to Pro for someone who may. */
export function ImportTrimmedNote({
  imported,
  leftOut,
  bound,
}: {
  imported: number;
  leftOut: number;
  bound: PagesBound | null;
}) {
  const offer = usePagesOffer(bound);
  if (!bound || leftOut <= 0) return null;
  return (
    <div data-import-trimmed="">
      <Callout
        tone="warning"
        role="status"
        {...(offer
          ? {
              action: {
                label: offer.label === 'Upgrade and Import All' ? 'Upgrade to Pro' : offer.label,
                onSelect: offer.open,
              },
            }
          : {})}
      >
        {trimmedToast(imported, leftOut, bound)}
      </Callout>
    </div>
  );
}
