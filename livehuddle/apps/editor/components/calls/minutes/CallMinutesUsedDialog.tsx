'use client';

// The owner's month of call minutes is used (docs/specs/012-collaboration/call-minutes.md "What people see",
// "Used"): what happened, until when, and the right way on for whoever is looking. The owner or a team admin is
// offered the upgrade, a team's member is pointed at an admin, and everyone else, guests included, is told calls are
// paused and nothing more: no offer, no meter, nothing about the owner's tier. The kit's notice decides the action.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Button, buttonClassName, DialogCloseButton, DialogHeader } from '@livehuddle/ui';
import { isOwnerScope } from '@liveworkspace/subscription';
import {
  LimitNotice,
  ownerViewOf,
  upgradeTier,
  UsageMeter,
  useOwnerView,
} from '@liveworkspace/subscription-ui';
import { Dialog } from '@liveworkspace/workbench/components/dialogs/Dialog';
import {
  CALL_MINUTES_TITLE,
  CALL_MINUTES_USED_TITLE,
  callMinutesOffer,
  callMinutesUsedOf,
  callMinutesUsedWords,
  CALLS_PAUSED_TITLE,
  callsPausedGuestWords,
  callsPausedWords,
} from '@/lib/calls/call-minutes-words';
import { apiCallMinutes, type CallsCaller } from '@/lib/api/calls';
import { useAuthHrefs } from '@/components/chrome/auth-shared';

export function CallMinutesUsedDialog({
  owner,
  guest,
  caller,
  used: usedTold,
  limit: limitTold,
  onClose,
}: {
  // The Space's owner as the server named them to this person: null for a signed-out visitor and a guest's Space.
  owner: string | null;
  // The Space's owner has no account: the way on is to sign in, never an upgrade.
  guest: boolean;
  // Who asks the api for the numbers, where they are this person's to see and no word has brought them.
  caller: CallsCaller | null;
  // The numbers as the server said them; null where it gave none (the room's word to everyone never carries them).
  used: number | null;
  limit: number | null;
  onClose: () => void;
}) {
  const load = useOwnerView(owner !== null && isOwnerScope(owner) ? owner : null);
  const { signInHref } = useAuthHrefs();
  // The clock as the dialog first drew: the day the month starts again.
  const [now] = useState(() => Date.now());
  const view = ownerViewOf(load);
  // The owner, or someone on the owning team: the count is theirs to see.
  const theirs = view !== null && view.action !== 'none';
  // Their numbers, read from the api when the word that paused the call brought none (it gives them to the owner
  // and the owning team alone). `read`: settled, with or without numbers.
  const [read, setRead] = useState<{ used: number; limit: number } | 'none' | null>(null);
  const known = usedTold !== null && limitTold !== null;
  useEffect(() => {
    if (!theirs || known || !caller) return;
    let live = true;
    apiCallMinutes(caller)
      .then((answer) => {
        if (!live) return;
        setRead(
          answer.metered && answer.used !== null && answer.limit !== null
            ? { used: answer.used, limit: answer.limit }
            : 'none',
        );
      })
      .catch(() => live && setRead('none'));
    return () => {
      live = false;
    };
  }, [theirs, known, caller]);
  // The words wait for who is looking and for their numbers, so they never change under the reader.
  if (load.status === 'loading') return null;
  if (theirs && !known && caller && read === null) return null;
  const numbers = known
    ? { used: usedTold, limit: limitTold }
    : read !== null && read !== 'none'
      ? read
      : null;
  const used = numbers?.used ?? 0;
  const limit = numbers?.limit ?? 0;
  const title = theirs ? CALL_MINUTES_USED_TITLE : CALLS_PAUSED_TITLE;
  return (
    <Dialog open onClose={onClose} ariaLabel={title} size="sm">
      <DialogHeader title={title}>
        <DialogCloseButton onClick={onClose} />
      </DialogHeader>
      <div
        data-call-minutes-used={view?.action ?? 'none'}
        className="flex flex-col gap-4 px-6 py-5"
      >
        {theirs && numbers ? (
          <UsageMeter
            limitKey="callMinutesPerMonth"
            label={CALL_MINUTES_TITLE}
            showLabel={false}
            layout="stacked"
            used={used}
            limit={limit}
            words={callMinutesUsedOf(used, limit)}
          />
        ) : null}
        <LimitNotice
          limitKey="callMinutesPerMonth"
          used={used}
          limit={limit}
          owner={theirs ? view : null}
          sentence={
            theirs
              ? callMinutesUsedWords(now)
              : guest
                ? callsPausedGuestWords(now)
                : callsPausedWords(now)
          }
          offer={
            view?.action === 'upgrade' && view.tier === 'free'
              ? callMinutesOffer(upgradeTier(view))
              : undefined
          }
          near={false}
          secondaryAction={
            <>
              {guest && !theirs ? (
                <Link
                  href={signInHref}
                  className={buttonClassName({
                    size: 'xs',
                    className: 'relative touch-target shrink-0',
                  })}
                >
                  Sign In
                </Link>
              ) : null}
              <Button
                variant="secondary"
                size="xs"
                className="relative touch-target shrink-0"
                onClick={onClose}
              >
                Back to the Space
              </Button>
            </>
          }
        />
      </div>
    </Dialog>
  );
}
