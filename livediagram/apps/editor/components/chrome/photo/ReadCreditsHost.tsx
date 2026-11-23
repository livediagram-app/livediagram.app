'use client';

// A photo read's AI credit, on the review (docs/specs/021-event-storming/note-reader.md "What the editor shows").
// Draws nothing, and loads nothing, with Pro off or until the api has said the read is counted: the line and the
// notice draw the subscription kit's parts, so they come only when there is something to say.
import dynamic from 'next/dynamic';
import { useSyncExternalStore } from 'react';
import { proOn } from '@liveworkspace/subscription-ui/flag';
import { readCredits, subscribeReadCredits } from '@/lib/reading/read-credits';

const ReadCreditsStatus = dynamic(
  () => import('./ReadCreditsStatus').then((m) => m.ReadCreditsStatus),
  { ssr: false },
);

export function ReadCreditsHost({ reading }: { reading: boolean }) {
  const credits = useSyncExternalStore(subscribeReadCredits, readCredits, readCredits);
  if (!proOn() || credits.owner === null) return null;
  return <ReadCreditsStatus credits={credits} reading={reading} />;
}
