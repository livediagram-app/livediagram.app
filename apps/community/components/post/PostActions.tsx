'use client';

import { useState } from 'react';
import type { CommunityPost } from '@livediagram/api-schema';
import { ButtonContent, CopyIcon, buttonClassName, formatCommunityCount } from '@livediagram/ui';
import { makeCopyHref, openDocumentHref } from '@/lib/links';
import { communityTelemetry } from '@/lib/telemetry';
import { useLike } from '@/lib/useLike';
import { FlagIcon, FullScreenIcon } from '../shared/icons';
import { LikeButton } from '../shared/LikeButton';
import { ReportDialog } from './ReportDialog';

// One chip in the panel's footer: the heart, the copy count and Report share its height and padding, so the row
// reads as one strip.
const POST_CHIP =
  'inline-flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-sm font-medium tabular-nums';

// The post's actions (docs/specs/025-community/community.md "Post"), as one panel: the two ways into the document
// side by side and of equal weight in size (Make a Copy, which opens it in the editor and copies it into the
// visitor's own documents in one step, leads in colour; Open Document is the read-only viewer, full screen), then a
// strip of how people responded (the heart, which likes in place, and the copy count) with Report at its end.
export function PostActions({ post }: { post: CommunityPost }) {
  const like = useLike(post);
  const [reporting, setReporting] = useState(false);
  const copies = post.copyCount;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-xs dark:border-slate-800 dark:bg-slate-900">
      <div className="grid gap-2 sm:grid-cols-2">
        <a
          href={makeCopyHref(post.shareCode)}
          onClick={() => communityTelemetry.copiedPost()}
          className={buttonClassName({ size: 'md', className: 'w-full justify-center shadow-sm' })}
        >
          <CopyIcon size={15} aria-hidden />
          <ButtonContent>Make a Copy</ButtonContent>
        </a>
        <a
          href={openDocumentHref(post.shareCode)}
          className={buttonClassName({
            variant: 'secondary',
            size: 'md',
            className: 'w-full justify-center',
          })}
        >
          <FullScreenIcon aria-hidden />
          <ButtonContent>Open Document</ButtonContent>
        </a>
      </div>
      <div className="flex items-center gap-1 border-t border-slate-100 pt-2 dark:border-slate-800">
        <LikeButton like={like} size="lg" />
        <span className={`${POST_CHIP} text-slate-500 dark:text-slate-400`}>
          <CopyIcon size={15} aria-hidden />
          <span>
            <span className="font-semibold">{formatCommunityCount(copies)}</span>{' '}
            {copies === 1 ? 'copy' : 'copies'}
          </span>
        </span>
        <button
          type="button"
          onClick={() => setReporting(true)}
          className={`${POST_CHIP} ml-auto text-slate-500 transition-colors duration-micro hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-brand-600 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200`}
        >
          <FlagIcon size={14} aria-hidden />
          Report
        </button>
      </div>
      {like.gone ? (
        <p role="status" className="px-1 text-sm text-amber-700 dark:text-amber-300">
          This post is no longer available.
        </p>
      ) : null}
      {reporting ? <ReportDialog postId={post.id} onClose={() => setReporting(false)} /> : null}
    </div>
  );
}
