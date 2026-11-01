'use client';

import { SaveSwitchRow } from '@livehuddle/ui';
import { kindWords } from '@liveworkspace/explorer';
import type { SaveLocationId } from '@/lib/save-locations';

const KIND = kindWords('livehuddle').one;

// The wizard's Sync Canvas to Server switch (docs/specs/006-document/save-locations.md "On the start screen"): the
// shared row, choosing where the create goes rather than moving anything. It shows the default for who is creating
// until the person flips it; `chosen` is null until then, so a sign-in that answers late still sets it.
export function NewSaveSwitch({
  chosen,
  signedIn,
  onChoose,
}: {
  chosen: SaveLocationId | null;
  signedIn: boolean;
  onChoose: (location: SaveLocationId) => void;
}) {
  return (
    <SaveSwitchRow
      kind={KIND}
      signedIn={signedIn}
      checked={chosen ? chosen === 'livehuddle' : signedIn}
      onChange={(on) => onChoose(on ? 'livehuddle' : 'browser')}
    />
  );
}
