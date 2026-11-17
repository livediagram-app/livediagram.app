'use client';

import { type FormEvent, useId, useState } from 'react';
import { FORUM_BODY_MAX, FORUM_REPLY_MIN, type ForumReply } from '@liveworkspace/community';
import { Button, TextArea } from '@liveworkspace/ui';
import { useCommunitySite } from '../client';
import { SignedInAction } from './SignedInAction';
import { forumErrorText, type ForumApi } from './forum-api';
import { authorOf, type ForumAccount } from './useForumAccount';

// Reply, at the foot of a topic (liveworkspace/docs/specs/007-community/community.md "The Forum", "On the page"): a
// field in place, then Reply. Signed out it is Sign In to Reply. The new reply shows at once under the others; when
// the check could not answer it says it is waiting, to its author alone.
export function ReplyComposer({
  api,
  account,
  topicId,
  onPosted,
}: {
  api: ForumApi;
  account: ForumAccount;
  topicId: string;
  onPosted: (reply: ForumReply) => void;
}) {
  const id = useId();
  const { telemetry } = useCommunitySite();
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  if (account.status !== 'in') {
    return (
      <div className="flex flex-col items-start gap-3 rounded-2xl border border-dashed border-slate-300 p-5 sm:flex-row sm:items-center sm:justify-between dark:border-slate-700">
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Have something to add? Join the conversation.
        </p>
        <SignedInAction
          account={account}
          label="Reply"
          signInLabel="Sign In to Reply"
          onClick={() => {}}
          size="md"
        />
      </div>
    );
  }

  // Reply is never disabled for a reason it doesn't say: pressed too short, it says what it needs.
  const short = body.trim().length < FORUM_REPLY_MIN;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (sending) return;
    if (short) {
      setTried(true);
      return;
    }
    setSending(true);
    setError(null);
    try {
      const token = await account.getToken();
      if (!token) throw new Error('signed out');
      const reply = await api.createReply(topicId, { body, author: authorOf(account) }, token);
      telemetry.forum.postedReply();
      onPosted(reply);
      setBody('');
    } catch (err) {
      console.warn('[forum] reply failed', err);
      setError(forumErrorText(err));
    } finally {
      setSending(false);
    }
  };

  return (
    <form onSubmit={(e) => void submit(e)} className="flex flex-col gap-3">
      <label
        htmlFor={`${id}-body`}
        className="text-sm font-semibold text-slate-900 dark:text-white"
      >
        Your Reply
      </label>
      <TextArea
        id={`${id}-body`}
        value={body}
        maxLength={FORUM_BODY_MAX}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        aria-invalid={tried && short ? true : undefined}
        aria-describedby={tried && short ? `${id}-needs` : undefined}
        placeholder="Add to the conversation. Plain text: paragraphs and line breaks are kept."
      />
      {error ? (
        <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <p id={`${id}-needs`} className="text-xs font-medium text-rose-600 dark:text-rose-400">
          {tried && short ? `Write at least ${FORUM_REPLY_MIN} characters.` : null}
        </p>
        <Button type="submit" size="md" busy={sending}>
          {sending ? 'Posting...' : 'Reply'}
        </Button>
      </div>
    </form>
  );
}
