'use client';

// The quiet line that closes the rail while the document's owner's tier keeps automatic versions for a time
// (docs/specs/006-document/version-history.md "With Pro on"): the shared ProNote, with See Pro for someone who may
// upgrade the owner. The server said how long; nothing here works a limit out. Nothing with Pro off, or on a tier with
// no age limit.
import type { VersionRetentionInfo } from '@livedocuments/api-schema';
import { isOwnerScope } from '@liveworkspace/subscription';
import { ProNote, useOwnerView } from '@liveworkspace/subscription-ui';

/** "Free keeps 7 days of history. Pro keeps it forever." Only Free keeps history for a time. */
export function versionRetentionSentence(days: number): string {
  return `Free keeps ${days === 1 ? '1 day' : `${days} days`} of history. Pro keeps it forever.`;
}

/** "History here is kept for 7 days.": the same for anyone who cannot act on the owner's tier, with no tier named. */
export function versionRetentionOthersSentence(days: number): string {
  return `History here is kept for ${days === 1 ? '1 day' : `${days} days`}.`;
}

export function VersionRetentionNote({ retention }: { retention: VersionRetentionInfo | null }) {
  const owner = useOwnerView(isOwnerScope(retention?.owner) ? retention.owner : null);
  if (!retention || retention.days === null) return null;
  return (
    <ProNote
      owner={owner}
      limitKey="historyDays"
      layout="rail"
      others={versionRetentionOthersSentence(retention.days)}
    >
      {versionRetentionSentence(retention.days)}
    </ProNote>
  );
}
