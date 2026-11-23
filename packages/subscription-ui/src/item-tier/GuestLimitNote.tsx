'use client';

// A limit met in a guest's item (liveworkspace/docs/specs/019-subscription/subscription.md "A guest's item"): the item's
// owner has no account, so the limit is Free's and nobody is offered an upgrade. The note says what was met and to
// sign in, with the app's own Sign In link: signing in makes the item the person's own.

import { buttonClassName } from '@liveworkspace/ui';
import { Callout } from '@liveworkspace/ui/callout';

export function GuestLimitNote({ sentence, signInHref }: { sentence: string; signInHref: string }) {
  return (
    <Callout tone="info">
      <span data-guest-limit="" className="flex flex-wrap items-center justify-between gap-2">
        <span>{sentence}</span>
        <a href={signInHref} className={buttonClassName({ size: 'xs', className: 'shrink-0' })}>
          Sign In
        </a>
      </span>
    </Callout>
  );
}
