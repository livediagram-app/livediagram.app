'use client';

// Publish to the Web at the owner's tier's limit, with Pro on (docs/specs/030-knowledgebase/publishing.md "What the
// dialog shows"): every knowledgebase the owner may publish is out, so this one can't be until one comes down. The
// shared notice: Upgrade to Pro for the owner or a team admin (the offer in the sentence), Ask an Admin for a team's
// member, the plain limit for anyone else and for a guest's knowledgebase.
import { isOwnerScope } from '@liveworkspace/subscription';
import { LimitNotice, upgradeTier, useOwnerView } from '@liveworkspace/subscription-ui';
import { publishLimitSentence } from '@/lib/publishing/publish-limit';

export function PublishLimit({
  owner,
  used,
  max,
}: {
  // The knowledgebase's owner as the api names it; absent for a guest's.
  owner: string | undefined;
  used: number;
  max: number;
}) {
  const load = useOwnerView(isOwnerScope(owner) ? owner : null);
  const view = load.status === 'ready' ? load.view : null;
  const offer = view?.action === 'upgrade' ? upgradeTier(view) : null;
  return (
    <div data-publish-limit="">
      <LimitNotice
        limitKey="publicKnowledgebases"
        used={used}
        limit={max}
        owner={load}
        near={false}
        sentence={publishLimitSentence(max, offer)}
        offer=""
      />
    </div>
  );
}
