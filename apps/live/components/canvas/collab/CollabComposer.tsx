// The composer at the foot of a modern collab board (docs/specs/012-collaboration/qa-board.md, idea-box.md
// "The look"): a rounded field, a send button in the accent, a line of meta
// underneath (the board's own chip) and a counter once the limit is near.
// Enter posts. Shared so the Q&A board and the Idea box are written into the
// same way; each passes its own chip (the Q&A board's Anonymous switch, the
// Idea box's fixed Anonymous badge).

import { useRef, useState, type ReactNode } from 'react';
import type { CommentMention } from '@livediagram/diagram';
import { MentionMenu } from '@/components/primitives/MentionMenu';
import { useMentionAutocomplete } from '@/hooks/ui/useMentionAutocomplete';
import type { MentionScope } from './comment/MentionContext';
import { tint } from './collab-chrome';
import { QA_ACCENT, QA_ON_ACCENT, SendGlyph, stopPointer } from './qa/qa-parts';

export function CollabComposer({
  textColor,
  placeholder,
  ariaLabel,
  sendLabel,
  maxLength,
  meta,
  mentionScope,
  onSubmit,
}: {
  textColor: string;
  placeholder: string;
  ariaLabel: string;
  sendLabel: string;
  maxLength: number;
  meta?: ReactNode;
  // @-mentions (docs/specs/012-collaboration/comment-mentions.md): the Comment panel passes who can be
  // mentioned; the Q&A board and the Idea box are anonymous and pass nothing.
  mentionScope?: MentionScope;
  onSubmit: (text: string, mentions: CommentMention[]) => void;
}) {
  const [draft, setDraft] = useState('');
  const fieldRef = useRef<HTMLInputElement>(null);
  const text = draft.trim();
  const left = maxLength - draft.length;
  const mention = useMentionAutocomplete({
    value: draft,
    setValue: setDraft,
    scope: mentionScope ?? NO_MENTIONS,
    fieldRef,
  });

  const submit = () => {
    if (!text) return;
    onSubmit(text, mentionScope ? mention.take(text) : []);
    setDraft('');
  };

  return (
    <div
      className="relative flex w-full flex-col gap-1.5 rounded-2xl border p-1.5 transition-shadow focus-within:shadow-[0_0_0_3px_var(--qa-accent-soft)]"
      style={{ borderColor: tint(textColor, 0.16), backgroundColor: tint(textColor, 0.03) }}
    >
      {mentionScope && mention.open ? (
        <MentionMenu
          items={mention.items}
          highlight={mention.highlight}
          hint={mention.hint}
          onPick={mention.pick}
        />
      ) : null}
      <div className="flex items-center gap-1.5">
        <input
          ref={fieldRef}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            mention.onType(e);
          }}
          {...(mentionScope ? mention.bind : {})}
          onKeyDown={(e) => {
            // The canvas listens for plain keys (type-to-edit, shortcuts), so
            // every keystroke in here stops at the field.
            e.stopPropagation();
            if (mentionScope && mention.onKeyDown(e)) return;
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          {...stopPointer}
          placeholder={placeholder}
          aria-label={ariaLabel}
          maxLength={maxLength}
          className="pointer-events-auto min-w-0 flex-1 bg-transparent px-2 py-1 text-[12px] outline-none placeholder:opacity-45"
          style={{ color: textColor }}
        />
        <button
          type="button"
          {...stopPointer}
          onClick={(e) => {
            e.stopPropagation();
            submit();
          }}
          disabled={!text}
          aria-label={sendLabel}
          className="pointer-events-auto inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full transition hover:scale-105 active:scale-95 disabled:cursor-default disabled:opacity-35"
          style={{ backgroundColor: QA_ACCENT, color: QA_ON_ACCENT }}
        >
          <SendGlyph size={13} />
        </button>
      </div>
      {/* Only when it has something to say: an empty row under the field
          read as stray padding on a composer with no chip (the Comment
          panel's, docs/specs/012-collaboration/comment-pin.md). */}
      {meta || left <= 40 ? (
        <div className="flex items-center justify-between gap-2 px-1">
          {meta ?? <span />}
          {left <= 40 ? (
            <span
              className="text-[10px] font-medium tabular-nums"
              style={{ color: left <= 10 ? '#e11d48' : textColor, opacity: left <= 10 ? 1 : 0.5 }}
            >
              {left}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

const NO_MENTIONS: MentionScope = { candidates: [], available: true };
