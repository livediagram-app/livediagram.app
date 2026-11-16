'use client';

import { type FormEvent, type ReactNode, useId, useState } from 'react';
import {
  FORUM_BODY_MAX,
  FORUM_BODY_MIN,
  FORUM_REPLY_MIN,
  FORUM_TITLE_MAX,
  FORUM_TITLE_MIN,
  type ForumPost,
} from '@liveworkspace/community';
import { Button, TextArea, TextInput } from '@liveworkspace/ui';
import { ReportDialog } from '../post/ReportDialog';
import { DeleteIcon, EditIcon, FlagIcon } from '../shared/icons';
import { Byline, StateNote } from './ForumBits';
import { forumErrorText, type ForumApi } from './forum-api';
import { ForumReactions } from './ForumReactions';
import { authorOf, type ForumAccount } from './useForumAccount';

type Mode = 'reading' | 'editing' | 'deleting';

// One post in a topic, the question or a reply (liveworkspace/docs/specs/007-community/community.md "The Forum", "On
// the page"): who wrote it and when, the words as plain text (paragraphs and line breaks kept), its reactions, and
// what the reader may do with it. Its author edits it in place (the words become a field, Save and Cancel) and deletes
// it after asking in place (Delete and Keep); anyone else reports it. A post its author alone sees says why.
export function ForumPostCard({
  api,
  account,
  post,
  title,
  now,
  badge,
  answerAction,
  onChanged,
  onDeleted,
  className = '',
}: {
  api: ForumApi;
  account: ForumAccount;
  post: ForumPost;
  /** The topic's title, when this is the question (Edit then changes it too). */
  title?: string;
  now: number;
  /** A mark above the words (the answer's). */
  badge?: ReactNode;
  /** Mark as Answer, for the topic's author on a reply. */
  answerAction?: ReactNode;
  onChanged: (post: ForumPost) => void;
  onDeleted: () => void;
  className?: string;
}) {
  const id = useId();
  const [mode, setMode] = useState<Mode>('reading');
  const [draftTitle, setDraftTitle] = useState(title ?? '');
  const [draft, setDraft] = useState(post.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const isTopic = title !== undefined;
  const signedIn = account.status === 'in' ? account : null;
  const canChange = post.own && post.state !== 'hidden';
  const canReport = !post.own && post.state === 'listed';
  const minBody = isTopic ? FORUM_BODY_MIN : FORUM_REPLY_MIN;
  const readyToSave =
    draft.trim().length >= minBody &&
    (!isTopic || draftTitle.trim().length >= FORUM_TITLE_MIN) &&
    !busy;

  const startEditing = () => {
    setDraft(post.body);
    setDraftTitle(title ?? '');
    setError(null);
    setMode('editing');
  };

  const save = async (e: FormEvent) => {
    e.preventDefault();
    if (!signedIn || !readyToSave) return;
    setBusy(true);
    setError(null);
    try {
      const token = await signedIn.getToken();
      if (!token) throw new Error('signed out');
      const saved = await api.editPost(
        post.id,
        { ...(isTopic ? { title: draftTitle } : {}), body: draft, author: authorOf(signedIn) },
        token,
      );
      onChanged(saved);
      setMode('reading');
    } catch (err) {
      console.warn('[forum] edit failed', err);
      setError(forumErrorText(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!signedIn) return;
    setBusy(true);
    setError(null);
    try {
      const token = await signedIn.getToken();
      if (!token) throw new Error('signed out');
      await api.deletePost(post.id, token);
      onDeleted();
    } catch (err) {
      console.warn('[forum] delete failed', err);
      setError(forumErrorText(err));
      setBusy(false);
    }
  };

  return (
    <article
      aria-labelledby={`${id}-by`}
      className={`flex flex-col gap-3 rounded-2xl border bg-white p-4 shadow-xs sm:p-5 dark:bg-slate-900 ${className || 'border-slate-200 dark:border-slate-800'}`}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div id={`${id}-by`}>
          <Byline
            author={post.author}
            createdAt={post.createdAt}
            editedAt={post.editedAt}
            now={now}
          />
        </div>
        {badge}
      </header>
      {post.own ? <StateNote state={post.state} /> : null}

      {mode === 'editing' ? (
        <form onSubmit={(e) => void save(e)} className="flex flex-col gap-3">
          {isTopic ? (
            <TextInput
              aria-label="Title"
              value={draftTitle}
              maxLength={FORUM_TITLE_MAX}
              onChange={(e) => setDraftTitle(e.target.value)}
            />
          ) : null}
          <TextArea
            aria-label={isTopic ? 'Your Question' : 'Your Reply'}
            value={draft}
            maxLength={FORUM_BODY_MAX}
            onChange={(e) => setDraft(e.target.value)}
            rows={Math.min(12, Math.max(3, draft.split('\n').length + 1))}
            autoFocus
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Saving checks it again before anyone else sees the change.
          </p>
          {error ? (
            <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
              {error}
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button
              variant="secondary"
              size="md"
              onClick={() => setMode('reading')}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="submit" size="md" disabled={!readyToSave} busy={busy}>
              {busy ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </form>
      ) : (
        <p className="whitespace-pre-line break-words text-[15px] leading-relaxed text-slate-800 dark:text-slate-100">
          {post.body}
        </p>
      )}

      {mode === 'deleting' ? (
        <div
          role="group"
          aria-label={isTopic ? 'Delete this question?' : 'Delete this reply?'}
          className="flex flex-col gap-3 rounded-xl bg-slate-50 p-3 ring-1 ring-inset ring-slate-200 sm:flex-row sm:items-center sm:justify-between dark:bg-slate-800/60 dark:ring-slate-700"
        >
          <p className="text-sm text-slate-700 dark:text-slate-200">
            {isTopic
              ? 'Delete this question and every reply to it? This cannot be undone.'
              : 'Delete this reply? This cannot be undone.'}
          </p>
          {error ? (
            <p role="alert" className="text-sm text-rose-700 dark:text-rose-300">
              {error}
            </p>
          ) : null}
          <div className="flex shrink-0 justify-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setMode('reading')}
              disabled={busy}
              autoFocus
            >
              Keep
            </Button>
            <Button variant="primary" size="sm" onClick={() => void remove()} busy={busy}>
              {busy ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      ) : null}

      {mode === 'reading' ? (
        <footer className="flex flex-wrap items-center justify-between gap-2">
          <ForumReactions
            api={api}
            account={account}
            post={post}
            onChange={(reactions) => onChanged({ ...post, reactions })}
          />
          <div className="ml-auto flex flex-wrap items-center gap-1">
            {answerAction}
            {canChange ? (
              <Button variant="ghost" size="sm" onClick={startEditing}>
                <EditIcon aria-hidden />
                Edit
              </Button>
            ) : null}
            {post.own ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setError(null);
                  setMode('deleting');
                }}
              >
                <DeleteIcon aria-hidden />
                Delete
              </Button>
            ) : null}
            {canReport ? (
              <Button variant="ghost" size="sm" onClick={() => setReporting(true)}>
                <FlagIcon aria-hidden />
                Report
              </Button>
            ) : null}
          </div>
        </footer>
      ) : null}

      {reporting ? (
        <ReportDialog
          noun={isTopic ? 'question' : 'reply'}
          send={(input) => api.reportPost(post.id, input)}
          onClose={() => setReporting(false)}
        />
      ) : null}
    </article>
  );
}
