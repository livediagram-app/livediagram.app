import type { TimingBucket, TimingScaleKey } from '@livediagram/api-schema';
import type { Noun } from './app';
import { bucketLabel } from './timing-stats';

// The sentence under a timing event (docs/specs/017-telemetry/timing-telemetry.md): what was timed, in
// the product's own words, and the range it fell in. Read by eventExplanation for Search and the cards.

const VITAL_MOMENTS: Readonly<Record<string, string>> = {
  Lcp: 'had its main content showing',
  Inp: 'answered its slowest click, tap or key',
  Cls: 'shifted its layout by a total',
};

export type TimingSentence = (timing: {
  metric: string;
  bucket: TimingBucket;
  scale: TimingScaleKey;
}) => string;

/** The sentences for an app whose editor opens a `noun` (its load timing is `<Noun>Load`). */
export function createTimingSentence(noun: Noun): TimingSentence {
  const editorMoments: Readonly<Record<string, string>> = {
    [`${noun.Title}Load`]: `A ${noun.one} opened`,
    TabLoad: 'A tab someone switched to loaded',
    Save: 'An autosave finished',
    RoomConnect: `A ${noun.one}'s live room connected`,
    RoomReconnect: 'A live room came back after dropping',
  };
  return ({ metric, bucket, scale }) => {
    const range = bucketLabel(scale, bucket);
    const editor = editorMoments[metric];
    if (editor) return `${editor} in ${range}.`;
    const [vital = '', app = ''] = metric.split('.');
    const moment = VITAL_MOMENTS[vital] ?? 'was timed';
    return scale === 'Cls'
      ? `A page on the ${app} site ${moment} ${range}.`
      : `A page on the ${app} site ${moment} in ${range}.`;
  };
}
