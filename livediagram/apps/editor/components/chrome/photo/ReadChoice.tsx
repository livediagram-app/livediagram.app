'use client';

// The choice before a charged photo read (docs/specs/021-event-storming/note-reader.md "What the editor shows"): read
// the notes with AI, at the credits it costs (one for every 24 notes, the same count the server spends), or on this
// device for nothing. What is left this month is said where this person may know it: from the owner's usage as the
// subscription kit reads it, else the count the last read of this diagram answered. Too few left disables the AI
// with the reason; none left shows the kit's used notice with the right offer for whoever is looking.
import { itemPayerScope, photoReadCredits, usesAiCredits } from '@liveworkspace/subscription';
import { useSubscription } from '@liveworkspace/subscription-ui/provider';
import { AiCreditsNotice, tierUsage, useItemTier } from '@liveworkspace/subscription-ui/item-tier';
import { knownReadCount, readOwner } from '@/lib/reading/read-credits';
import {
  creditsLeftWords,
  creditsShortWords,
  READ_ON_DEVICE_LABEL,
  READ_ON_DEVICE_WORDS,
  readWithAiLabel,
} from '@/lib/reading/read-credits-words';
import { Button } from '@liveworkspace/ui';
import { PillButton } from './PillButton';

export function ReadChoice({
  notes,
  onChoose,
}: {
  // The photo's found notes: what the read costs.
  notes: number;
  onChoose: (onDevice: boolean) => void;
}) {
  const cost = photoReadCredits(notes);
  // Who pays: the diagram's owner (its team for a team's diagram), else the reader themself.
  const mine = useSubscription();
  const tier = useItemTier(
    itemPayerScope(readOwner()) ?? (mine.status === 'ready' ? mine.me.personal.owner : null),
  );
  const usage = tierUsage(tier, 'aiCredits');
  const count = usage ? { used: usage.used, max: usage.limit } : knownReadCount();
  const left = count ? Math.max(0, count.max - count.used) : null;
  const short = left !== null && left < cost;
  if (count && left === 0) {
    // On the notice's white card the free choice is the kit's own secondary button.
    const device = (
      <Button
        variant="secondary"
        size="xs"
        data-testid="photo-read-device"
        onClick={() => onChoose(true)}
      >
        {READ_ON_DEVICE_LABEL}
      </Button>
    );
    return (
      <div
        data-testid="photo-read-choice"
        data-read-choice="used"
        // A solid ground under the notice's tint: it sits over a photograph.
        className="pointer-events-auto w-[min(32rem,calc(100vw-1.5rem))] rounded-lg bg-white shadow-lg dark:bg-slate-900"
      >
        <AiCreditsNotice tier={tier} spent={count} byHand={device} />
        {tier.on && tier.settled ? null : (
          <div className="flex flex-col items-center gap-2 p-3 text-xs text-slate-600 dark:text-slate-300">
            <p>{creditsShortWords(cost, 0)}</p>
            {device}
          </div>
        )}
      </div>
    );
  }
  return (
    <div
      data-testid="photo-read-choice"
      data-read-choice={short ? 'short' : 'ready'}
      role="group"
      aria-label="How to read the notes"
      className="pointer-events-auto flex max-w-[min(34rem,90vw)] flex-col items-center gap-2 rounded-2xl bg-slate-900/90 px-4 py-3 text-center text-xs text-white shadow-lg backdrop-blur"
    >
      <div className="flex flex-wrap items-center justify-center gap-2">
        <PillButton
          tone="primary"
          data-testid="photo-read-ai"
          disabled={short}
          onClick={() => onChoose(false)}
        >
          <span>{readWithAiLabel(notes)}</span>
          <span className="font-normal opacity-80">· {usesAiCredits(cost)}</span>
        </PillButton>
        <PillButton data-testid="photo-read-device" onClick={() => onChoose(true)}>
          {READ_ON_DEVICE_LABEL}
        </PillButton>
      </div>
      <div data-testid="photo-read-choice-words" className="text-slate-300">
        {count ? (
          <p className="tabular-nums">
            {short ? creditsShortWords(cost, left) : creditsLeftWords(count.used, count.max)}
          </p>
        ) : null}
        <p>{READ_ON_DEVICE_WORDS}</p>
      </div>
    </div>
  );
}
