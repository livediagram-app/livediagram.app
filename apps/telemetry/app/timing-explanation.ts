import type { TimingBucket, TimingScaleKey } from '@livediagram/api-schema';
import { bucketLabel } from './timing-stats';

// The sentence under a timing event (docs/specs/017-telemetry/timing-telemetry.md): what was timed, in
// the product's own words, and the range it fell in. Read by eventExplanation for Search and the cards.

const EDITOR_MOMENTS: Readonly<Record<string, string>> = {
  DocumentLoad: 'A document opened',
  TabLoad: 'A tab someone switched to loaded',
  Save: 'An autosave finished',
  RoomConnect: "A document's live room connected",
  RoomReconnect: 'A live room came back after dropping',
};

const VITAL_MOMENTS: Readonly<Record<string, string>> = {
  Lcp: 'had its main content showing',
  Inp: 'answered its slowest click, tap or key',
  Cls: 'shifted its layout by a total',
};

export function timingSentence({
  metric,
  bucket,
  scale,
}: {
  metric: string;
  bucket: TimingBucket;
  scale: TimingScaleKey;
}): string {
  const range = bucketLabel(scale, bucket);
  const editor = EDITOR_MOMENTS[metric];
  if (editor) return `${editor} in ${range}.`;
  const [vital = '', app = ''] = metric.split('.');
  const moment = VITAL_MOMENTS[vital] ?? 'was timed';
  return scale === 'Cls'
    ? `A page on the ${app} site ${moment} ${range}.`
    : `A page on the ${app} site ${moment} in ${range}.`;
}
