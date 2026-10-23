import type { ReactNode } from 'react';
import type { Comparisons } from '../types';
import { AlternativeCard } from './AlternativeCard';
import type { Mark } from './mark';

// The hub's body, under the app's own hero (README.md "Routes"): a crawlable grid linking every
// /alternatives/<slug> page, closing on the app's "just try it" card.
export function ComparisonHub({
  comparisons,
  mark,
  tryIt,
}: {
  comparisons: Comparisons;
  mark: Mark;
  tryIt: ReactNode;
}) {
  return (
    <div className="mx-auto mt-14 grid max-w-6xl gap-5 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
      {comparisons.alternatives.map((alt) => (
        <AlternativeCard key={alt.slug} alt={alt} mark={mark} />
      ))}
      {tryIt}
    </div>
  );
}
