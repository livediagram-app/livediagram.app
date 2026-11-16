'use client';

import { type FormEvent, useId, useRef, useState } from 'react';
import {
  FORUM_BODY_MAX,
  FORUM_BODY_MIN,
  FORUM_CATEGORIES,
  FORUM_START_CATEGORY,
  FORUM_TITLE_MAX,
  FORUM_TITLE_MIN,
  type ForumApp,
  type ForumCategory,
  type ForumTopic,
} from '@liveworkspace/community';
import { Button, Select, TextArea, TextInput } from '@liveworkspace/ui';
import { forumErrorText, type ForumApi } from './forum-api';
import { ForumAppPicker } from './ForumAppPicker';
import { authorOf, type SignedIn } from './useForumAccount';

// New Post (liveworkspace/docs/specs/007-community/community.md "The Forum", "On the page"): the form inside the
// ResponsivePopover the page opens (a popover from sm up, a drawer on a phone), never in place in the page. The title,
// the category, the app (its logo) and the post, then Post. Post is never disabled for a reason it doesn't say: a
// press with a field too short marks it, says what it needs and focuses it. The draft lives in the page, so closing
// and opening again keeps what was typed.

export type ForumDraft = { title: string; category: ForumCategory; app: ForumApp; body: string };

export function newForumDraft(app: ForumApp): ForumDraft {
  return { title: '', category: FORUM_START_CATEGORY, app, body: '' };
}

type Problems = { title?: string; body?: string };

const TITLE_NEEDS = `Add a title of at least ${FORUM_TITLE_MIN} characters.`;
const BODY_NEEDS = `Write at least ${FORUM_BODY_MIN} characters.`;

function problemsOf(draft: ForumDraft): Problems {
  return {
    ...(draft.title.trim().length < FORUM_TITLE_MIN ? { title: TITLE_NEEDS } : {}),
    ...(draft.body.trim().length < FORUM_BODY_MIN ? { body: BODY_NEEDS } : {}),
  };
}

const LABEL = 'text-sm font-medium text-slate-700 dark:text-slate-200';
const HINT = 'text-xs text-slate-500 dark:text-slate-400';
const PROBLEM = 'text-xs font-medium text-rose-600 dark:text-rose-400';

export function ForumComposer({
  api,
  account,
  draft,
  onDraft,
  titleId,
  onPosted,
  onCancel,
}: {
  api: ForumApi;
  account: SignedIn;
  draft: ForumDraft;
  onDraft: (draft: ForumDraft) => void;
  /** The heading's id, the popover's accessible name. */
  titleId: string;
  onPosted: (topic: ForumTopic) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const titleRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Shown once Post has been pressed; after that each field's message follows what is typed.
  const [tried, setTried] = useState(false);
  const problems = tried ? problemsOf(draft) : {};
  const set = (patch: Partial<ForumDraft>) => onDraft({ ...draft, ...patch });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending) return;
    const found = problemsOf(draft);
    if (found.title || found.body) {
      setTried(true);
      (found.title ? titleRef : bodyRef).current?.focus();
      return;
    }
    setSending(true);
    setError(null);
    try {
      const token = await account.getToken();
      if (!token) throw new Error('signed out');
      const { category, app, title, body } = draft;
      onPosted(
        await api.createTopic({ category, app, title, body, author: authorOf(account) }, token),
      );
    } catch (err) {
      console.warn('[forum] post failed', err);
      setError(forumErrorText(err));
      setSending(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-4">
      <h2 id={titleId} className="text-base font-semibold text-slate-900 dark:text-white">
        New Post
      </h2>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-title`} className={LABEL}>
            Title
          </label>
          <TextInput
            ref={titleRef}
            id={`${id}-title`}
            value={draft.title}
            maxLength={FORUM_TITLE_MAX}
            onChange={(e) => set({ title: e.target.value })}
            placeholder="How do I…"
            aria-invalid={problems.title ? true : undefined}
            aria-describedby={`${id}-title-note`}
            autoFocus
          />
          <p id={`${id}-title-note`} className={problems.title ? PROBLEM : HINT}>
            {problems.title ?? `At least ${FORUM_TITLE_MIN} characters.`}
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-category`} className={LABEL}>
            Category
          </label>
          <Select
            id={`${id}-category`}
            value={draft.category}
            onChange={(e) => set({ category: e.target.value as ForumCategory })}
            selectClassName="h-10 w-full text-sm sm:w-44"
            className="w-full sm:w-auto"
          >
            {FORUM_CATEGORIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <span id={`${id}-app`} className={LABEL}>
          App
        </span>
        <ForumAppPicker
          value={draft.app}
          onChange={(app) => set({ app })}
          labelledBy={`${id}-app`}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-body`} className={LABEL}>
          Your Post
        </label>
        <TextArea
          ref={bodyRef}
          id={`${id}-body`}
          value={draft.body}
          maxLength={FORUM_BODY_MAX}
          onChange={(e) => set({ body: e.target.value })}
          rows={5}
          placeholder="Share a tip, show what you've made, suggest an idea or ask a question. Plain text: paragraphs and line breaks are kept."
          aria-invalid={problems.body ? true : undefined}
          aria-describedby={`${id}-body-note ${id}-count`}
        />
        <p className="flex justify-between gap-3">
          <span id={`${id}-body-note`} className={problems.body ? PROBLEM : HINT}>
            {problems.body ?? `At least ${FORUM_BODY_MIN} characters.`}
          </span>
          <span id={`${id}-count`} className={`${HINT} shrink-0 tabular-nums`}>
            {draft.body.length} / {FORUM_BODY_MAX}
          </span>
        </p>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" size="md" onClick={onCancel} disabled={sending}>
          Cancel
        </Button>
        <Button type="submit" size="md" busy={sending}>
          {sending ? 'Posting...' : 'Post'}
        </Button>
      </div>
    </form>
  );
}
