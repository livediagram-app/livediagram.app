'use client';

import { useEffect, useRef, useState } from 'react';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { communityCategoryLabel, type CommunityOwnPost } from '@livediagram/api-schema';
import { Button, buttonClassName, lucideGlyph } from '@livediagram/ui';
import { lucideExternalLink, lucideGlobe } from '@livediagram/icons/lucide';
import { communityErrorMessage } from '@/lib/community-errors';
import { communityPostPath } from '@/lib/community-links';
import { track } from '@/lib/telemetry';
import { useToast } from '@/hooks/ui/useToast';
import { SECTION_LABEL } from '../share-dialog-parts';
import { communitySectionState } from './community-section-state';

const GlobeIcon = lucideGlyph(lucideGlobe, 16);
const OpenIcon = lucideGlyph(lucideExternalLink, 12);

const NOTE = 'text-xs leading-relaxed text-slate-600 dark:text-slate-300';

// The Share dialog's Community band (docs/specs/025-community/community.md "Publishing"; final copy in
// the blueprint §9), beneath the passes and the password. Which face it shows is
// communitySectionState's decision; this only draws it. Publishing and Edit Listing open the publish
// dialog (the caller's), Remove From Community asks once, here, before it goes.
export function CommunitySection({
  signedIn,
  signInHref,
  teamDocument,
  sharePassword,
  post,
  loading,
  error,
  onPublish,
  onEdit,
  onRemove,
}: {
  signedIn: boolean;
  // Sign in, coming back to this document afterwards.
  signInHref: string;
  teamDocument: boolean;
  // A share password and a post exclude each other: with one set, Share to Community is disabled.
  sharePassword: string | null;
  post: CommunityOwnPost | null;
  loading: boolean;
  error: string | null;
  onPublish: () => void;
  onEdit: () => void;
  onRemove: () => Promise<void>;
}) {
  const toast = useToast();
  const [confirming, setConfirming] = useState(false);
  const [removing, setRemoving] = useState(false);
  // Remove asks in place of the buttons, so the focused control goes away each time the row swaps: focus follows it
  // (into the question, back to Remove From Community, or to Share to Community once the post is gone) rather than
  // falling out of the dialog.
  const sectionRef = useRef<HTMLElement>(null);
  const focusNext = useRef<'confirm' | 'actions' | 'share' | null>(null);
  useEffect(() => {
    const target = focusNext.current;
    if (!target) return;
    focusNext.current = null;
    sectionRef.current?.querySelector<HTMLElement>(`[data-focus="${target}"]`)?.focus();
  });
  const ask = (next: boolean, then: 'confirm' | 'actions') => {
    focusNext.current = then;
    setConfirming(next);
  };
  const state = communitySectionState({ signedIn, teamDocument, loading, error, post });

  const remove = async () => {
    setRemoving(true);
    try {
      await onRemove();
      track('Community', 'Removed', 'Post');
      toast.success('Removed from the Community');
      focusNext.current = 'share';
      setConfirming(false);
    } catch (err) {
      toast.error(communityErrorMessage(err));
    } finally {
      setRemoving(false);
    }
  };

  return (
    <section
      ref={sectionRef}
      aria-labelledby="share-community-heading"
      className="flex flex-col gap-2.5 border-t border-slate-100 pt-4 dark:border-slate-800"
    >
      <p id="share-community-heading" className={`${SECTION_LABEL} flex items-center gap-1.5`}>
        <GlobeIcon />
        Community
        <HelpArticleLink article="community" className="ml-auto" />
      </p>

      {state === 'guest' ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={NOTE}>Sign in to share your document with the Community.</p>
          <a href={signInHref} className={buttonClassName({ variant: 'secondary', size: 'xs' })}>
            Sign In to Share
          </a>
        </div>
      ) : null}

      {state === 'team' ? (
        <p className={NOTE}>Team library documents can&rsquo;t be shared to the Community.</p>
      ) : null}

      {state === 'loading' ? (
        <div
          aria-busy="true"
          aria-label="Loading"
          className="h-9 animate-pulse rounded-lg bg-slate-100 motion-reduce:animate-none dark:bg-slate-800"
        />
      ) : null}

      {state === 'error' ? <p className={NOTE}>{error}</p> : null}

      {state === 'unpublished' ? (
        <div className="flex flex-col gap-2">
          <p className={NOTE}>
            The Community is <strong className="font-semibold">public</strong>: anyone, with or
            without an account, can find this document there, view it and make their own copy.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="xs"
              data-focus="share"
              onClick={onPublish}
              disabled={sharePassword !== null}
            >
              Share to Community
            </Button>
            {sharePassword !== null ? (
              <span className="text-xs text-slate-500 dark:text-slate-400">
                Remove the share password to share it to the Community.
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {(state === 'published' || state === 'hidden') && post ? (
        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 px-3 py-2.5 dark:border-slate-700">
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
              {post.title}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {communityCategoryLabel(post.category)} ·{' '}
              <span className="tabular-nums">
                <span aria-hidden>♥</span>
                <span className="sr-only">Likes</span> {post.likeCount} · Copied {post.copyCount}{' '}
                {post.copyCount === 1 ? 'time' : 'times'}
              </span>
            </p>
            {state === 'hidden' ? (
              <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                <span className="font-medium">Hidden after reports.</span> Several people reported
                it, so it was taken out of the Community for good. Only you can see it, and it can
                no longer be changed or removed.
              </p>
            ) : null}
          </div>
          {confirming ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
              <p className="flex-1 text-xs text-slate-600 dark:text-slate-300">
                Remove it from the Community? Its likes and copy count go too; copies people made
                stay theirs.
              </p>
              <Button
                variant="secondary"
                size="xs"
                data-focus="confirm"
                onClick={() => ask(false, 'actions')}
                disabled={removing}
              >
                Keep It
              </Button>
              <Button variant="danger" size="xs" onClick={remove} disabled={removing}>
                {removing ? 'Removing' : 'Remove'}
              </Button>
            </div>
          ) : state === 'hidden' ? null : (
            <div className="flex flex-wrap items-center gap-2">
              <a
                href={communityPostPath(post.id)}
                target="_blank"
                rel="noopener"
                className={buttonClassName({ variant: 'secondary', size: 'xs' })}
              >
                <OpenIcon />
                View Post
              </a>
              <Button variant="secondary" size="xs" onClick={onEdit}>
                Edit Listing
              </Button>
              <Button
                variant="caution"
                size="xs"
                data-focus="actions"
                onClick={() => ask(true, 'confirm')}
              >
                Remove From Community
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
