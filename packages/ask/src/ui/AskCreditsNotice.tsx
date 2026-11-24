'use client';

// A question the month's AI credits refused, with Pro on (liveworkspace/docs/specs/020-ask/ask.md "AI credits"): the
// kit's limit notice in place of the answer's warning, so the right way on is offered to whoever is looking. The
// owner, or a team's admin, is offered the upgrade; a team's member is pointed at an admin; anyone else reads the
// plain fact. The words wait for who is looking, so they never change under the reader.
import { isOwnerScope } from '@liveworkspace/subscription';
import { LimitNotice, ownerViewOf, useOwnerView } from '@liveworkspace/subscription-ui';
import { Button } from '@liveworkspace/ui';
import type { AskCreditsUsed } from '../wire';

export function AskCreditsNotice({
  credits,
  message,
  onAskAgain,
}: {
  credits: AskCreditsUsed;
  message: string;
  onAskAgain: () => void;
}) {
  const load = useOwnerView(isOwnerScope(credits.owner) ? credits.owner : null);
  if (load.status === 'loading') return null;
  const view = ownerViewOf(load);
  return (
    <div data-ask-credits-used={view?.action ?? 'none'}>
      <LimitNotice
        limitKey="aiCreditsPerMonth"
        // The numbers reach the owner's side alone; anyone else's notice is the plain fact at its limit.
        used={credits.used ?? 1}
        limit={credits.max ?? 1}
        owner={view}
        sentence={message}
        near={false}
        secondaryAction={
          <Button
            variant="secondary"
            size="xs"
            className="touch-target relative shrink-0"
            onClick={onAskAgain}
          >
            Ask Again
          </Button>
        }
      />
    </div>
  );
}
