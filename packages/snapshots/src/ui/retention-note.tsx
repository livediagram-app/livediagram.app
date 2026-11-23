'use client';

// The quiet line under an item's snapshots while its owner's tier keeps them for a time (liveworkspace/docs/specs/
// 014-snapshots/snapshots.md "With Pro on"): the kit's ProNote, with See Pro for someone who may upgrade the owner.
// The server said how long; nothing here works a limit out. Nothing with Pro off, or on a tier with no age limit.

import { isOwnerScope, parseOwnerScope, TIER_NAMES } from '@liveworkspace/subscription';
import { ProNote, useOwnerView } from '@liveworkspace/subscription-ui';
import type { SnapshotRetentionInfo } from '../wire';
import { othersRetentionSentence, retentionSentence } from './snapshot-words';

export function SnapshotRetentionNote({
  retention,
  layout,
}: {
  retention: SnapshotRetentionInfo | null;
  // `box` where it stands among History's own blocks; the dialog's foot when not given.
  layout?: 'foot' | 'box';
}) {
  const owner = useOwnerView(isOwnerScope(retention?.owner) ? retention.owner : null);
  if (!retention || retention.days === null) return null;
  // A team's admin and member are told the team's tier; anyone else reads how long snapshots last, with no tier.
  const action = owner.status === 'ready' ? owner.view.action : 'none';
  const team = parseOwnerScope(retention.owner ?? '')?.kind === 'team' && action !== 'none';
  return (
    <ProNote
      owner={owner}
      limitKey="historyDays"
      layout={layout}
      others={othersRetentionSentence(retention.days)}
    >
      {retentionSentence(retention.days, team ? TIER_NAMES.team : TIER_NAMES.pro)}
    </ProNote>
  );
}
