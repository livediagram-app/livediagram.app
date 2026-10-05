'use client';

import { useEffect, useId, useState } from 'react';
import {
  COMMUNITY_DESCRIPTION_MAX,
  COMMUNITY_DESCRIPTION_MIN,
  COMMUNITY_TITLE_MAX,
  communityCategoryType,
  validateCommunityPostInput,
  type CommunityAuthor,
  type CommunityCategory,
  type CommunityOwnPost,
  type CommunityPostInput,
} from '@livediagram/api-schema';
import { Button, TextInput } from '@livediagram/ui';
import { Dialog } from '@/components/dialogs/Dialog';
import { DialogCloseButton } from '@/components/dialogs/DialogCloseButton';
import { DialogFooter } from '@/components/dialogs/DialogFooter';
import { DialogHeader } from '@/components/dialogs/DialogHeader';
import { apiCommunityPopularTags } from '@/lib/api-client';
import { communityCodeMessage, communityErrorMessage } from '@/lib/community-errors';
import { track } from '@/lib/telemetry';
import { useToast } from '@/hooks/ui/useToast';
import { CategoryPicker } from './CategoryPicker';
import { CommunityCardPreview } from './CommunityCardPreview';
import { CommunityPublishedConfirmation } from './CommunityPublishedConfirmation';
import { TagInput } from './TagInput';

// The plain-words consequences of publishing (docs/specs/025-community/community.md "Publishing";
// final copy in the blueprint §9).
const CONSEQUENCES = [
  'Anyone can view this board and make their own copy.',
  'Your later edits show in the Community too.',
  'Comments stay private.',
  'You can remove it at any time.',
];

const LABEL = 'text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400';

// Share to Community and Edit Listing (docs/specs/025-community/community.md "Publishing"): title,
// description, category, tags, a preview of the card and what publishing means. The input is checked
// with the same validator the worker runs before it is sent, and the worker's refusals are worded by
// the same table. A first publish ends on a celebration with the post's link; an edit just closes.
export function CommunityPublishDialog({
  post,
  documentName,
  ownerId,
  documentId,
  author,
  onPublish,
  onClose,
}: {
  // The current post for Edit Listing; null to publish.
  post: CommunityOwnPost | null;
  documentName: string;
  ownerId: string;
  documentId: string;
  author: CommunityAuthor;
  onPublish: (input: CommunityPostInput) => Promise<CommunityOwnPost>;
  onClose: () => void;
}) {
  const editing = post !== null;
  const toast = useToast();
  const titleId = useId();
  const categoryLabelId = useId();
  const descriptionHintId = useId();
  const [title, setTitle] = useState(() =>
    (post?.title ?? documentName).slice(0, COMMUNITY_TITLE_MAX),
  );
  const [description, setDescription] = useState(post?.description ?? '');
  const [category, setCategory] = useState<CommunityCategory | null>(post?.category ?? null);
  const [tags, setTags] = useState<string[]>(post?.tags ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [published, setPublished] = useState<CommunityOwnPost | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    void apiCommunityPopularTags().then((popular) => {
      if (!cancelled) setSuggestions(popular);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const descriptionLength = description.trim().length;
  const descriptionShort = descriptionLength < COMMUNITY_DESCRIPTION_MIN;

  const submit = async () => {
    const checked = validateCommunityPostInput({ title, description, category, tags });
    if (!checked.ok) {
      setError(communityCodeMessage(checked.error));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const saved = await onPublish(checked.value);
      const type = communityCategoryType(saved.category);
      if (editing) {
        track('Community', 'Changed', type);
        toast.success('Listing saved');
        onClose();
      } else {
        track('Community', 'Shared', type);
        setPublished(saved);
      }
    } catch (err) {
      setError(communityErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      titleId={published ? 'community-publish-title' : titleId}
      size="xl"
      closeOnEscape={!busy}
      className="max-h-[calc(100%-2rem)]"
      phoneSheet
    >
      {published ? (
        <CommunityPublishedConfirmation
          postId={published.id}
          title={published.title}
          onDone={onClose}
        />
      ) : (
        <form
          className="flex min-h-0 flex-col"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <DialogHeader
            title={<span id={titleId}>{editing ? 'Edit Listing' : 'Share to Community'}</span>}
            subtitle="Show what you made. Others can find it, learn from it and make their own copy."
          >
            <DialogCloseButton onClick={onClose} />
          </DialogHeader>

          <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
            <label className="flex flex-col gap-1">
              <span className={LABEL}>Title</span>
              <TextInput
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={COMMUNITY_TITLE_MAX}
                disabled={busy}
                autoFocus
              />
            </label>

            <label className="flex flex-col gap-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className={LABEL}>Description</span>
                <span
                  className={`text-xs tabular-nums ${
                    descriptionLength > 0 && descriptionShort
                      ? 'text-amber-700 dark:text-amber-300'
                      : 'text-slate-400'
                  }`}
                >
                  {descriptionLength} / {COMMUNITY_DESCRIPTION_MAX}
                </span>
              </span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={COMMUNITY_DESCRIPTION_MAX}
                rows={4}
                disabled={busy}
                aria-describedby={descriptionHintId}
                className="w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <span id={descriptionHintId} className="text-xs text-slate-500 dark:text-slate-400">
                What it shows, how you made it, how someone could reuse it.
                {descriptionShort ? ` At least ${COMMUNITY_DESCRIPTION_MIN} characters.` : ''}
              </span>
            </label>

            <div className="flex flex-col gap-1.5">
              <span id={categoryLabelId} className={LABEL}>
                Category
              </span>
              <CategoryPicker
                value={category}
                onChange={setCategory}
                labelledBy={categoryLabelId}
                disabled={busy}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <span className={LABEL}>Tags</span>
              <TagInput tags={tags} onChange={setTags} suggestions={suggestions} disabled={busy} />
            </div>

            <div className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-[13rem_1fr] dark:border-slate-800">
              <div className="flex flex-col gap-1.5">
                <span className={LABEL}>Preview</span>
                <CommunityCardPreview
                  ownerId={ownerId}
                  documentId={documentId}
                  title={title}
                  category={category}
                  tags={tags}
                  author={author}
                  likeCount={post?.likeCount}
                  copyCount={post?.copyCount}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <span className={LABEL}>Good to Know</span>
                <ul className="flex flex-col gap-1.5 text-sm text-slate-600 dark:text-slate-300">
                  {CONSEQUENCES.map((line) => (
                    <li key={line} className="flex gap-2">
                      <span
                        aria-hidden
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-brand-400"
                      />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {error ? (
              <p
                role="alert"
                className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-200"
              >
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button variant="secondary" size="xs" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" size="xs" disabled={busy}>
              {busy ? 'Saving' : editing ? 'Save Changes' : 'Share to Community'}
            </Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  );
}
