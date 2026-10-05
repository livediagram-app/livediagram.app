'use client';

import { useState } from 'react';
import Link from 'next/link';
import { communityCategoryLabel, type CommunityPost } from '@livediagram/api-schema';
import { relativeSince } from '@livediagram/ui';
import { formatDate, paragraphs } from '@/lib/format';
import { tagHref } from '@/lib/links';
import { AuthorBadge } from '../shared/AuthorBadge';

// What a post says about itself (docs/specs/025-community/community.md "Post"): title, author,
// publish date, category, tags (each opening the gallery filtered by it) and the full description,
// its paragraphs kept.
export function PostMeta({ post }: { post: CommunityPost }) {
  // The instant "3 days ago" is measured from, fixed when the post renders so render stays pure.
  const [now] = useState(() => Date.now());
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        <span className="w-fit rounded-md bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 ring-1 ring-brand-200/60 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-500/30">
          {communityCategoryLabel(post.category)}
        </span>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
          {post.title}
        </h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-600 dark:text-slate-300">
          <AuthorBadge author={post.author} size={28} className="font-medium" />
          <span aria-hidden className="text-slate-300 dark:text-slate-600">
            &middot;
          </span>
          <time
            dateTime={new Date(post.publishedAt).toISOString()}
            aria-label={`Shared ${formatDate(post.publishedAt)}`}
            className="text-slate-500 dark:text-slate-400"
          >
            Shared {relativeSince(post.publishedAt, now)}
          </time>
        </div>
      </div>
      <div className="flex max-w-prose flex-col gap-3 text-[15px] leading-relaxed text-slate-700 dark:text-slate-300">
        {paragraphs(post.description).map((p, i) => (
          <p key={i} className="whitespace-pre-line">
            {p}
          </p>
        ))}
      </div>
      {post.tags.length > 0 ? (
        <ul aria-label="Tags" className="flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <li key={tag}>
              <Link
                href={tagHref(tag)}
                className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600 transition-colors duration-micro hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand-500/50 dark:hover:text-brand-200"
              >
                #{tag}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
