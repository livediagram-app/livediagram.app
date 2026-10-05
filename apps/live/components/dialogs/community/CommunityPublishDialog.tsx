'use client';

import { useEffect, useId, useState } from 'react';
import {
  COMMUNITY_DESCRIPTION_MAX,
  COMMUNITY_DESCRIPTION_MIN,
  COMMUNITY_TITLE_MAX,
  communityCategoryType,
  validateCommunityPostInput,
  COMMUNITY_ANONYMOUS_AUTHOR,
  type CommunityAuthor,
  type CommunityOwnPost,
  type CommunityPostInput,
} from '@livediagram/api-schema';
import { Button, TextInput, DialogHeader, DialogCloseButton } from '@livediagram/ui';
import { Dialog } from '@/components/dialogs/Dialog';
import { SwitchRow } from '@/components/primitives/SwitchRow';
import { DialogFooter } from '@/components/dialogs/DialogFooter';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { apiCommunityPopularTags } from '@/lib/api-client';
import { ApiError } from '@/lib/api/core';
import { communityErrorMessage } from '@/lib/community-errors';
import { track } from '@/lib/telemetry';
import { useToast } from '@/hooks/ui/useToast';
import { CategoryPicker } from './CategoryPicker';
import { CommunityCardPreview } from './CommunityCardPreview';
import { CommunityPublishedConfirmation } from './CommunityPublishedConfirmation';
import { FieldError } from './FieldError';
import { TagInput } from './TagInput';
import { usePublishForm } from './usePublishForm';

// The plain-words consequences of publishing (docs/specs/025-community/community.md "Publishing";
// final copy in the blueprint §9).
const CONSEQUENCES = [
  'Anyone can view this document and make their own copy.',
  'Your later edits show in the Community too.',
  'Comments stay private.',
  'You can remove it at any time.',
];

const LABEL = 'text-xs font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400';
// A field with a problem: a rose border and ring, so it is easy to spot.
const INVALID =
  'border-rose-400 ring-2 ring-rose-100 dark:border-rose-400/70 dark:ring-rose-500/20';

// Share to Community and Edit Listing (docs/specs/025-community/community.md "Publishing"): title,
// description, category, tags, a preview of the card and what publishing means. The input is checked
// with the same validator the worker runs before it is sent. A problem with a field is shown under that
// field, and a failed submit takes the person to the first one (usePublishForm); a refusal that is not
// about a field sits in the footer beside the button. A first publish ends on a celebration with the
// post's link; an edit just closes.
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
  const errorId = useId();
  const form = usePublishForm(post, documentName);
  const { title, description, category, tags, anonymous } = form.draft;
  const { errors } = form;
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
  const fieldErrorId = (field: string) => `${errorId}-${field}`;

  const submit = async () => {
    setError(null);
    const checked = validateCommunityPostInput(form.draft);
    if (!form.check() || !checked.ok) return;
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
      if (!(err instanceof ApiError && form.showServerError(err.code))) {
        setError(communityErrorMessage(err));
      }
    } finally {
      setBusy(false);
    }
  };

  // Not while saving: closing mid-save would lose the answer (a refusal to show, or the published confirmation).
  const titleFieldId = useId();
  const descriptionFieldId = useId();
  const closeUnlessBusy = () => {
    if (!busy) onClose();
  };

  return (
    <Dialog
      open
      onClose={closeUnlessBusy}
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
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <DialogHeader
            title={<span id={titleId}>{editing ? 'Edit Listing' : 'Share to Community'}</span>}
            subtitle="Show what you made. Others can find it, learn from it and make their own copy."
          >
            <HelpArticleLink article="community" size="md" />
            <DialogCloseButton onClick={closeUnlessBusy} />
          </DialogHeader>

          <div className="flex flex-col gap-4 overflow-y-auto px-6 py-5">
            {/* Each field: a label naming it alone, then its message and hint, which the control points to with
                aria-describedby rather than carrying in its name. */}
            <div ref={form.register('title')} className="flex flex-col gap-1">
              <label htmlFor={titleFieldId} className={LABEL}>
                Title
              </label>
              <TextInput
                id={titleFieldId}
                value={title}
                onChange={(e) => form.setTitle(e.target.value)}
                maxLength={COMMUNITY_TITLE_MAX}
                disabled={busy}
                autoFocus
                aria-invalid={errors.title ? true : undefined}
                aria-describedby={errors.title ? fieldErrorId('title') : undefined}
                className={errors.title ? INVALID : undefined}
              />
              <FieldError id={fieldErrorId('title')} message={errors.title} />
            </div>

            <div ref={form.register('description')} className="flex flex-col gap-1">
              <span className="flex items-baseline justify-between gap-2">
                <label htmlFor={descriptionFieldId} className={LABEL}>
                  Description
                </label>
                <span
                  className={`text-xs tabular-nums ${
                    errors.description
                      ? 'font-medium text-rose-600 dark:text-rose-300'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {descriptionLength} / {COMMUNITY_DESCRIPTION_MAX}
                </span>
              </span>
              <textarea
                id={descriptionFieldId}
                value={description}
                onChange={(e) => form.setDescription(e.target.value)}
                maxLength={COMMUNITY_DESCRIPTION_MAX}
                rows={4}
                disabled={busy}
                aria-invalid={errors.description ? true : undefined}
                aria-describedby={
                  errors.description
                    ? `${fieldErrorId('description')} ${descriptionHintId}`
                    : descriptionHintId
                }
                className={`w-full resize-y rounded-md border bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-100 dark:bg-slate-900 dark:text-slate-100 ${
                  errors.description ? INVALID : 'border-slate-200 dark:border-slate-700'
                }`}
              />
              <FieldError id={fieldErrorId('description')} message={errors.description} />
              <span id={descriptionHintId} className="text-xs text-slate-500 dark:text-slate-400">
                What it shows, how you made it, how someone could reuse it. At least{' '}
                {COMMUNITY_DESCRIPTION_MIN} characters.
              </span>
            </div>

            <div ref={form.register('category')} className="flex flex-col gap-1.5">
              <span id={categoryLabelId} className={LABEL}>
                Category
              </span>
              <CategoryPicker
                value={category}
                onChange={form.setCategory}
                labelledBy={categoryLabelId}
                describedBy={errors.category ? fieldErrorId('category') : undefined}
                invalid={!!errors.category}
                disabled={busy}
              />
              <FieldError id={fieldErrorId('category')} message={errors.category} />
            </div>

            <div ref={form.register('tags')} className="flex flex-col gap-1.5">
              <span className={LABEL}>Tags</span>
              <TagInput
                tags={tags}
                onChange={form.setTags}
                suggestions={suggestions}
                disabled={busy}
                error={errors.tags}
              />
            </div>

            <SwitchRow
              checked={anonymous}
              onChange={form.setAnonymous}
              className="rounded-lg border border-slate-200 px-3 py-2.5 dark:border-slate-700"
            >
              <span className="block text-sm font-medium text-slate-800 dark:text-slate-100">
                Share Anonymously
              </span>
              <span className="block text-xs text-slate-500 dark:text-slate-400">
                {anonymous
                  ? 'Shown as Anonymous. Your name and picture stay private.'
                  : `Shown with your name, ${author.name}.`}
              </span>
            </SwitchRow>

            <div className="grid gap-4 border-t border-slate-100 pt-4 sm:grid-cols-[15rem_1fr] dark:border-slate-800">
              <div className="flex flex-col gap-1.5">
                <span className={LABEL}>Preview</span>
                <CommunityCardPreview
                  ownerId={ownerId}
                  documentId={documentId}
                  title={title}
                  category={category}
                  tags={tags}
                  author={anonymous ? COMMUNITY_ANONYMOUS_AUTHOR : author}
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
          </div>

          <DialogFooter>
            {error ? (
              <p
                role="alert"
                className="mr-auto text-sm font-medium text-rose-600 dark:text-rose-300"
              >
                {error}
              </p>
            ) : null}
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
