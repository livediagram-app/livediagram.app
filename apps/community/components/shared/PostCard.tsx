'use client';

import Link from 'next/link';
import { communityCategoryLabel, type CommunityPost } from '@livediagram/api-schema';
import { CopyIcon } from '@livediagram/ui';
import { postImageUrl } from '@/lib/api';
import { formatCount } from '@/lib/format';
import { postHref } from '@/lib/links';
import { useLike } from '@/lib/useLike';
import { AuthorBadge } from './AuthorBadge';
import { LikeButton } from './LikeButton';

// How many tags a card shows (docs/specs/025-community/community.md "Gallery").
const CARD_TAGS = 3;

// One post in the grid (docs/specs/025-community/community.md "Gallery"; blueprint §9-§11): the live
// image in a fixed 4:3 box on a dot grid (no layout shift), title, category, up to three tags, the
// author, the heart and the copy count. The whole card opens the post through the title's stretched
// link; the heart sits above it and likes in place. Lifts on hover, unless motion is reduced.
export function PostCard({ post }: { post: CommunityPost }) {
  const like = useLike(post);
  const tags = post.tags.slice(0, CARD_TAGS);
  return (
    <article className="card-lift group relative flex flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm shadow-slate-900/5 focus-within:ring-2 focus-within:ring-brand-500 dark:border-slate-800 dark:bg-slate-900 dark:shadow-black/20">
      <div className="dot-grid relative aspect-[4/3] overflow-hidden border-b border-slate-100 dark:border-slate-800">
        <img
          src={postImageUrl(post.shareCode)}
          alt={post.title}
          loading="lazy"
          decoding="async"
          className="card-image absolute inset-0 h-full w-full object-contain p-5"
        />
        <span className="absolute left-3 top-3 rounded-md bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-slate-600 shadow-sm ring-1 ring-slate-900/5 backdrop-blur dark:bg-slate-900/85 dark:text-slate-300 dark:ring-white/10">
          {communityCategoryLabel(post.category)}
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-2 p-4">
        <h3 className="line-clamp-2 text-[15px] font-semibold leading-snug text-slate-900 dark:text-slate-100">
          <Link
            href={postHref(post.id)}
            className="outline-none after:absolute after:inset-0 after:content-['']"
          >
            {post.title}
          </Link>
        </h3>
        {tags.length > 0 ? (
          <ul className="flex flex-wrap gap-x-2 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
            {tags.map((tag) => (
              <li key={tag}>#{tag}</li>
            ))}
          </ul>
        ) : null}
        <div className="mt-auto flex items-center justify-between gap-3 pt-2 text-xs text-slate-600 dark:text-slate-300">
          <AuthorBadge author={post.author} />
          <div className="flex shrink-0 items-center gap-1">
            <LikeButton like={like} />
            <span
              className="inline-flex items-center gap-1 px-1.5 py-1 tabular-nums text-slate-500 dark:text-slate-400"
              aria-label={`Copied ${post.copyCount} ${post.copyCount === 1 ? 'time' : 'times'}`}
            >
              <CopyIcon size={13} aria-hidden />
              <span aria-hidden>{formatCount(post.copyCount)}</span>
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
