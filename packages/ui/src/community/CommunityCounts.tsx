import { CopyIcon } from '../icons/actions';
import { HeartIcon } from '../icons/community';
import { formatCommunityCount } from './format-count';

// How a post has done, as a card's corner shows it (docs/specs/025-community/community.md "Gallery"): the copy count,
// and, where the heart is not a button (the landing page), the like count. The words are for screen readers (the
// numbers alone would be read as bare digits); sighted readers get the icons.

const STAT =
  'inline-flex items-center gap-1 px-1.5 py-1 tabular-nums text-slate-500 dark:text-slate-400';

// The word for a count, one or many ("1 like", "3 likes"): one source for every count the Community shows.
export const communityPlural = (n: number, one: string, many: string) => (n === 1 ? one : many);
const plural = (n: number, one: string, many: string) => `${n} ${communityPlural(n, one, many)}`;

export function CommunityCopyCount({ count }: { count: number }) {
  return (
    <span className={STAT}>
      <CopyIcon size={13} aria-hidden />
      <span aria-hidden>{formatCommunityCount(count)}</span>
      <span className="sr-only">{plural(count, 'copy', 'copies')}</span>
    </span>
  );
}

export function CommunityLikeCount({ count }: { count: number }) {
  return (
    <span className={STAT}>
      <HeartIcon size={13} aria-hidden />
      <span aria-hidden>{formatCommunityCount(count)}</span>
      <span className="sr-only">{plural(count, 'like', 'likes')}</span>
    </span>
  );
}
