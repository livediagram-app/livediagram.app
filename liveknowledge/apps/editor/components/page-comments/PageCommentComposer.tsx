'use client';

// The composer at a page's foot (docs/specs/030-knowledgebase/page-comments.md "At the foot of the page"): a field that
// grows with its words (the platform's useAutoHeight, as every comment composer's), posting with its button or Cmd or
// Ctrl Enter, Escape clearing it (or cancelling an edit or a reply). The same field starts a thread, replies, and
// edits one's own comment. 44 px tall controls on a phone.
import { useRef, useState } from 'react';
import { COMMENT_TEXT_MAX } from '@liveknowledge/api-schema';
import { useAutoHeight } from '@liveworkspace/workbench/hooks/ui/useAutoHeight';
import { Button, GlyphDisc, IDENTITY_FILL, identityVars, lucideGlyph } from '@liveknowledge/ui';
import { lucideSend } from '@liveworkspace/icons/lucide';
import { initialsOf } from '@/lib/identity';
import { modifierName } from '@/lib/page-edit/page-edit-text';

const SendIcon = lucideGlyph(lucideSend, 14);

function Kbd({ children }: { children: string }) {
  return (
    <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-px font-sans text-[10px] font-medium text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400">
      {children}
    </kbd>
  );
}

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
  /** The start composer: the writer's disc beside it, resting as one line until it is focused. */
  me?: { name: string; color: string } | undefined;
  /** The field's name when the placeholder says more than it ("Add a comment"). */
  label?: string;
  /** Inside a thread: a soft filled line, no card of its own, a smaller disc. */
  inline?: boolean;
};

export function PageCommentComposer({
  placeholder,
  submitLabel,
  initial = '',
  autoFocus = false,
  onSubmit,
  onCancel,
  me,
  label,
  inline = false,
}: PageCommentComposerProps) {
  const modifier = modifierName(typeof navigator === 'undefined' ? undefined : navigator.platform);
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
  const [focused, setFocused] = useState(false);
  // The start composer rests as one quiet line with the writer's disc; its actions open with focus or words.
  const open = !me || focused || draft.length > 0;
  return (
    <div
      data-page-comment-composer=""
      data-open={open ? '' : undefined}
      onFocus={() => setFocused(true)}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setFocused(false);
      }}
      className={`group/composer flex gap-3 border transition-[border-color,box-shadow,background-color] duration-150 motion-reduce:transition-none ${
        inline
          ? 'rounded-xl p-1.5 pl-2 gap-2.5'
          : 'rounded-2xl bg-white p-2 pl-3 shadow-[0_1px_2px_rgb(15_23_42/0.04)] dark:bg-slate-900'
      } ${
        tooLong
          ? 'border-rose-400 dark:border-rose-500/70'
          : focused
            ? `border-brand-400 ring-4 ring-brand-500/10 dark:border-brand-500 ${inline ? 'bg-white dark:bg-slate-900' : ''}`
            : inline
              ? 'border-transparent bg-slate-50 hover:bg-slate-100/80 dark:bg-slate-800/50 dark:hover:bg-slate-800'
              : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
      }`}
    >
      {me ? (
        <GlyphDisc
          size={inline ? 24 : 28}
          as="span"
          aria-hidden
          style={identityVars(me.color)}
          className={`mt-1 shrink-0 text-[11px] font-semibold text-white ${IDENTITY_FILL}`}
        >
          {initialsOf(me.name)}
        </GlyphDisc>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <textarea
          ref={ref}
          value={draft}
          rows={1}
          autoFocus={autoFocus}
          aria-label={label ?? placeholder.replace(/\.+$|…$/, '')}
          placeholder={placeholder}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              void submit();
            } else if (e.key === 'Escape') {
              e.stopPropagation();
              if (onCancel) onCancel();
              else {
                setDraft('');
                e.currentTarget.blur();
              }
            }
          }}
          style={{ maxHeight: MAX.px }}
          className="block min-h-9 w-full resize-none bg-transparent py-1.5 pr-1 font-sans text-sm leading-6 text-slate-800 outline-none placeholder:text-slate-400 phone:min-h-11 dark:text-slate-100 dark:placeholder:text-slate-500"
        />
        {open ? (
          <div className="flex items-center justify-end gap-2 pt-1 motion-safe:animate-fade-in">
            {tooLong ? (
              <p className="mr-auto text-xs tabular-nums text-rose-700 dark:text-rose-300">
                {words.length.toLocaleString('en')}/{COMMENT_TEXT_MAX.toLocaleString('en')}
              </p>
            ) : (
              <p className="mr-auto hidden text-[11px] text-slate-400 sm:block dark:text-slate-500">
                <Kbd>{modifier}</Kbd> <Kbd>Enter</Kbd> to {submitLabel.toLowerCase()}
              </p>
            )}
            {onCancel ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="cursor-pointer rounded-full phone:min-h-11"
              >
                Cancel
              </Button>
            ) : null}
            <Button
              variant="primary"
              size="sm"
              disabled={!ready}
              onClick={() => void submit()}
              className="cursor-pointer gap-1.5 rounded-full pl-3 pr-3.5 phone:min-h-11"
            >
              <SendIcon />
              {submitLabel}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
