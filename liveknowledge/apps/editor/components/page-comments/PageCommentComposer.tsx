'use client';

// The composer at a page's foot (docs/specs/030-knowledgebase/page-comments.md "At the foot of the page"): a field that
// grows with its words (the platform's useAutoHeight, as every comment composer's), posting with its button or Cmd or
// Ctrl Enter, Escape clearing it (or cancelling an edit or a reply). The same field starts a thread, replies, and
// edits one's own comment. 44 px tall controls on a phone.
import { useRef, useState } from 'react';
import { COMMENT_TEXT_MAX } from '@liveknowledge/api-schema';
import { useAutoHeight } from '@liveworkspace/workbench/hooks/ui/useAutoHeight';
import { Button } from '@liveknowledge/ui';

const MAX = { px: 200 };

export type PageCommentComposerProps = {
  /** "Add a comment...", "Reply..." */
  placeholder: string;
  /** The button's word: Comment, Reply, Save. */
  submitLabel: string;
  initial?: string;
  autoFocus?: boolean;
  /** Resolves true once posted: the field clears. */
  onSubmit: (text: string) => Promise<boolean>;
  /** A reply or an edit has Cancel; the thread's own composer has none. */
  onCancel?: () => void;
};

export function PageCommentComposer({
  placeholder,
  submitLabel,
  initial = '',
  autoFocus = false,
  onSubmit,
  onCancel,
}: PageCommentComposerProps) {
  const [draft, setDraft] = useState(initial);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLTextAreaElement>(null);
  useAutoHeight(ref, draft, MAX);
  const words = draft.trim();
  const tooLong = words.length > COMMENT_TEXT_MAX;
  const ready = words.length > 0 && !tooLong && !busy && words !== initial.trim();
  const submit = async () => {
    if (!ready) return;
    setBusy(true);
    try {
      if (await onSubmit(words)) setDraft('');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div data-page-comment-composer="" className="flex flex-col gap-2">
      <textarea
        ref={ref}
        value={draft}
        rows={1}
        autoFocus={autoFocus}
        aria-label={placeholder.replace(/\.+$|…$/, '')}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            void submit();
          } else if (e.key === 'Escape') {
            e.stopPropagation();
            if (onCancel) onCancel();
            else setDraft('');
          }
        }}
        style={{ maxHeight: MAX.px }}
        className={`block min-h-10 w-full resize-none rounded-xl border bg-white px-3 py-2 font-sans text-sm leading-6 text-slate-800 outline-none transition placeholder:text-slate-400 focus:ring-2 motion-reduce:transition-none phone:min-h-11 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-400 ${
          tooLong
            ? 'border-rose-400 focus:ring-rose-400/30 dark:border-rose-500/70'
            : 'border-slate-200 focus:border-brand-400 focus:ring-brand-400/30 dark:border-slate-700 dark:focus:border-brand-500'
        }`}
      />
      <div className="flex items-center justify-end gap-2">
        {tooLong ? (
          <p className="mr-auto text-xs tabular-nums text-rose-700 dark:text-rose-300">
            {words.length.toLocaleString('en')}/{COMMENT_TEXT_MAX.toLocaleString('en')}
          </p>
        ) : null}
        {onCancel ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="cursor-pointer phone:min-h-11"
          >
            Cancel
          </Button>
        ) : null}
        <Button
          variant="primary"
          size="sm"
          disabled={!ready}
          onClick={() => void submit()}
          className="cursor-pointer phone:min-h-11"
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );
}
