'use client';

import { useState, type MouseEvent } from 'react';
import { formatCount } from '@/lib/format';
import type { LikeState } from '@/lib/useLike';
import { HeartIcon } from './icons';

// The heart (blueprint §10): a toggle button with aria-pressed and a label that carries the count. On
// a card it sits above the card's stretched link and never navigates. The pop on liking is CSS
// (`.heart-pop`), switched off under reduced motion.
export function LikeButton({ like, size = 'sm' }: { like: LikeState; size?: 'sm' | 'lg' }) {
  const { liked, likeCount, toggle, gone } = like;
  // Pop only on a like the person just made, not on a heart that loads already liked.
  const [pop, setPop] = useState(false);
  const onClick = (e: MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setPop(!liked);
    toggle();
  };
  const label = `Like (${likeCount} ${likeCount === 1 ? 'like' : 'likes'})`;
  const large = size === 'lg';
  return (
    <button
      type="button"
      aria-pressed={liked}
      aria-label={label}
      disabled={gone}
      onClick={onClick}
      className={`group/like relative z-10 inline-flex items-center gap-1.5 rounded-lg font-semibold tabular-nums transition-colors duration-micro focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-50 ${
        large ? 'border px-3.5 py-2 text-sm' : 'px-2 py-1 text-xs'
      } ${
        liked
          ? `text-rose-600 dark:text-rose-400 ${large ? 'border-rose-200 bg-rose-50 dark:border-rose-500/40 dark:bg-rose-500/10' : 'bg-rose-50 dark:bg-rose-500/10'}`
          : `text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:text-slate-400 dark:hover:bg-rose-500/10 dark:hover:text-rose-400 ${large ? 'border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900' : ''}`
      }`}
    >
      <HeartIcon
        size={large ? 18 : 15}
        aria-hidden
        fill={liked ? 'currentColor' : 'none'}
        className={pop && liked ? 'heart-pop' : ''}
      />
      <span>{large ? (liked ? 'Liked' : 'Like') : formatCount(likeCount)}</span>
      {large ? <span className="font-medium opacity-70">{formatCount(likeCount)}</span> : null}
    </button>
  );
}
