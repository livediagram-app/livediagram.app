'use client';

import { type FormEvent, useId, useState } from 'react';
import {
  FORUM_BODY_MAX,
  FORUM_BODY_MIN,
  FORUM_CATEGORIES,
  FORUM_TITLE_MAX,
  FORUM_TITLE_MIN,
  type ForumCategory,
  type ForumTopic,
} from '@liveworkspace/community';
import { Button, Select, TextArea, TextInput } from '@liveworkspace/ui';
import { forumErrorText, type ForumApi } from './forum-api';
import { authorOf, type SignedIn } from './useForumAccount';

// Ask a Question (liveworkspace/docs/specs/007-community/community.md "The Forum", "On the page"): a composer in place
// above the list, never a dialog: the title, the category (the page's app's to start) and the question, then Post
// Question. The service checks it before anyone else sees it; the page then opens the new topic, which says if it
// is waiting.
export function ForumComposer({
  api,
  account,
  startCategory,
  onPosted,
  onCancel,
}: {
  api: ForumApi;
  account: SignedIn;
  startCategory: ForumCategory;
  onPosted: (topic: ForumTopic) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<ForumCategory>(startCategory);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const ready =
    title.trim().length >= FORUM_TITLE_MIN && body.trim().length >= FORUM_BODY_MIN && !sending;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!ready) return;
    setSending(true);
    setError(null);
    try {
      const token = await account.getToken();
      if (!token) throw new Error('signed out');
      onPosted(await api.createTopic({ category, title, body, author: authorOf(account) }, token));
    } catch (err) {
      console.warn('[forum] ask failed', err);
      setError(forumErrorText(err));
      setSending(false);
    }
  };

  return (
    <form
      onSubmit={(e) => void submit(e)}
      aria-labelledby={`${id}-heading`}
      className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 dark:border-slate-800 dark:bg-slate-900"
    >
      <h2 id={`${id}-heading`} className="text-base font-semibold text-slate-900 dark:text-white">
        Ask a Question
      </h2>
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`${id}-title`}
            className="text-sm font-medium text-slate-700 dark:text-slate-200"
          >
            Title
          </label>
          <TextInput
            id={`${id}-title`}
            value={title}
            maxLength={FORUM_TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="How do I…"
            autoFocus
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`${id}-category`}
            className="text-sm font-medium text-slate-700 dark:text-slate-200"
          >
            Category
          </label>
          <Select
            id={`${id}-category`}
            value={category}
            onChange={(e) => setCategory(e.target.value as ForumCategory)}
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
        <label
          htmlFor={`${id}-body`}
          className="text-sm font-medium text-slate-700 dark:text-slate-200"
        >
          Your Question
        </label>
        <TextArea
          id={`${id}-body`}
          value={body}
          maxLength={FORUM_BODY_MAX}
          onChange={(e) => setBody(e.target.value)}
          rows={5}
          placeholder="Say what you tried and what you expected. Plain text: paragraphs and line breaks are kept."
          aria-describedby={`${id}-count`}
          required
        />
        <p className="flex justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">
          <span>Checked before anyone else sees it. Your name shows on it.</span>
          <span id={`${id}-count`} className="shrink-0 tabular-nums">
            {body.length} / {FORUM_BODY_MAX}
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
        <Button type="submit" size="md" disabled={!ready} busy={sending}>
          {sending ? 'Posting...' : 'Post Question'}
        </Button>
      </div>
    </form>
  );
}
