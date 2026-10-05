'use client';

import { useState } from 'react';
import type { CommunityPost } from '@livediagram/api-schema';
import { ButtonContent, CopyIcon, buttonClassName } from '@livediagram/ui';
import { makeCopyHref, openBoardHref } from '@/lib/links';
import { communityTelemetry } from '@/lib/telemetry';
import { useLike } from '@/lib/useLike';
import { FlagIcon, FullScreenIcon } from '../shared/icons';
import { LikeButton } from '../shared/LikeButton';
import { ReportDialog } from './ReportDialog';

// The post's actions (docs/specs/025-community/community.md "Post"): Like, Make a Copy (the editor
// opens the document and copies it into the visitor's own documents in one step), Open Document (the
// read-only viewer, full screen) and Report.
export function PostActions({ post }: { post: CommunityPost }) {
  const like = useLike(post);
  const [reporting, setReporting] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <a
          href={makeCopyHref(post.shareCode)}
          onClick={() => communityTelemetry.copiedPost()}
          className={buttonClassName({ size: 'md', className: 'shadow-sm' })}
        >
          <CopyIcon size={15} aria-hidden />
          <ButtonContent>Make a Copy</ButtonContent>
        </a>
        <a
          href={openBoardHref(post.shareCode)}
          className={buttonClassName({ variant: 'secondary', size: 'md' })}
        >
          <FullScreenIcon aria-hidden />
          <ButtonContent>Open Document</ButtonContent>
        </a>
        <LikeButton like={like} size="lg" />
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
        <span>
          Copied {post.copyCount} {post.copyCount === 1 ? 'time' : 'times'}
        </span>
        <button
          type="button"
          onClick={() => setReporting(true)}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium transition-colors duration-micro hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-brand-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <FlagIcon size={13} aria-hidden />
          Report
        </button>
      </div>
      {like.gone ? (
        <p role="status" className="text-sm text-amber-700 dark:text-amber-300">
          This post is no longer available.
        </p>
      ) : null}
      {reporting ? <ReportDialog postId={post.id} onClose={() => setReporting(false)} /> : null}
    </div>
  );
}
