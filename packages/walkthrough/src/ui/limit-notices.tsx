'use client';

// A walkthrough's tier limits in the Walkthroughs list (liveworkspace/docs/specs/006-media/walkthroughs.md "With Pro
// on"), through the kit's LimitNotice: at the stored limit, in place of Record Walkthrough; and once a recording that
// ran to its length limit is saved. The offer is only for someone who may upgrade the owner the server named; anyone
// else reads the limit. Nothing with Pro off: the server then answers no limits to draw.

import type { WalkthroughLimits } from '@liveworkspace/media/walkthrough';
import { isOwnerScope } from '@liveworkspace/subscription';
import {
  LimitNotice,
  ownerViewOf,
  upgradeTier,
  useOwnerView,
  type OwnerViewLoad,
} from '@liveworkspace/subscription-ui';
import { Button } from '@liveworkspace/ui';
import { ProNote } from '@liveworkspace/subscription-ui';
import {
  lengthLimitWords,
  lengthNoteWords,
  storedLimitSentence,
  type LimitReader,
} from '../limit-words';

/** What this person may know of the owner whose tier set a limit, and what they may be offered. */
function useReader(scope: string | null | undefined): {
  owner: OwnerViewLoad;
  reader: LimitReader;
} {
  const owner = useOwnerView(isOwnerScope(scope) ? scope : null);
  const view = ownerViewOf(owner);
  return {
    owner,
    reader: {
      tier: view?.tier ?? null,
      upgradeTo: view && view.action === 'upgrade' ? upgradeTier(view) : null,
    },
  };
}

/** In place of Record Walkthrough while the person keeps as many as they may. How many they keep is their own
 *  tier's, whoever owns the item, so the offer is for their own account. */
export function StoredLimitNotice({ limits }: { limits: WalkthroughLimits }) {
  const { owner, reader } = useReader(
    limits.storedOwner === undefined ? limits.owner : limits.storedOwner,
  );
  return (
    <LimitNotice
      limitKey="walkthroughsStored"
      used={limits.stored}
      limit={limits.storedLimit}
      owner={owner}
      near={false}
      sentence={storedLimitSentence(limits.stored, reader)}
      offer=""
    />
  );
}

/** Over the list once a recording that ran to its limit is saved. */
export function LengthLimitNotice({
  limits,
  onWatch,
}: {
  limits: WalkthroughLimits;
  onWatch: () => void;
}) {
  const { owner, reader } = useReader(limits.owner);
  const words = lengthLimitWords(limits.maxMs, reader);
  return (
    <LimitNotice
      limitKey="walkthroughMaxMs"
      used={limits.maxMs}
      limit={limits.maxMs}
      owner={owner}
      near={false}
      title={words.title}
      sentence={words.sentence}
      offer={words.offer}
      primaryAction={
        <Button size="xs" className="relative touch-target shrink-0" onClick={onWatch}>
          Watch It
        </Button>
      }
    />
  );
}

/** At the list's foot, before anything is recorded and after: how long a recording here may run, while the tier above
 *  records longer, so nobody meets the limit only by reaching it (owner, 2026-11-22). */
export function LengthNote({ limits }: { limits: WalkthroughLimits }) {
  const { owner, reader } = useReader(limits.owner);
  const words = lengthNoteWords(limits.maxMs, reader);
  if (!words) return null;
  return (
    <ProNote owner={owner} limitKey="walkthroughMaxMs" layout="rail" others={words.others}>
      {words.offer}
    </ProNote>
  );
}
