'use client';

// Request Access on the Not Found card (liveworkspace/docs/specs/004-index/request-access.md "On screen"; each
// product's new-file route spec, "Which not-found card"): the card's row of buttons with Request Access last, as the
// primary. Pressing it opens an optional note in place, under the row, with Send Request and Cancel (Ctrl or Cmd with
// Enter sends, Escape cancels). Sent, the button becomes a green Requested and a line says what happens next; the
// answer is the same for every address, so it says nothing about whether the item exists.
import { takeRequestIntent } from './request-intent';
import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ACCESS_REQUEST_NOTE_MAX } from '@liveworkspace/index-client';
import { Button, TextArea, Tooltip, lucideGlyph } from '@liveworkspace/ui';
import { lucideCheck, lucideKey } from '@liveworkspace/icons/lucide';
import {
  REQUEST_FAILURE_TEXT,
  REQUESTED_LINE,
  useAskForAccess,
  type AskForAccess,
} from './requested';

const KeyGlyph = lucideGlyph(lucideKey, 16);
const CheckGlyph = lucideGlyph(lucideCheck, 16);

// The count shows once the note nears its limit.
const COUNT_FROM = 250;

export function RequestAccess({
  itemId,
  noun,
  leading,
  ask,
}: {
  itemId: string;
  noun: string;
  // The card's other buttons, before Request Access in the same row.
  leading?: ReactNode;
  ask?: AskForAccess;
}) {
  const { requested, sending, failed, send } = useAskForAccess(itemId, ask);
  // Back from Sign In to Request Access: the note opens at once (request-intent.ts).
  const [writing, setWriting] = useState(takeRequestIntent);
  const [note, setNote] = useState('');
  const noteId = useId();
  const field = useRef<HTMLTextAreaElement>(null);
  const opener = useRef<HTMLButtonElement>(null);
  const reopen = useRef(false);
  useEffect(() => {
    if (writing) field.current?.focus();
    else if (reopen.current) {
      reopen.current = false;
      opener.current?.focus();
    }
  }, [writing]);
  const cancel = () => {
    reopen.current = true;
    setWriting(false);
  };
  const submit = () => void send(note);
  const shown = writing && !requested;

  return (
    <div className="mt-6 flex w-full flex-col items-center" data-request-access="">
      <div className="flex flex-wrap items-center justify-center gap-2">
        {leading}
        {requested ? (
          <span
            role="status"
            data-request-access-state="requested"
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-emerald-50 px-3 text-sm font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-200 dark:ring-emerald-500/30"
          >
            <CheckGlyph />
            Requested
          </span>
        ) : shown ? null : (
          <Tooltip label="Ask its owner to share it with you">
            <Button
              ref={opener}
              size="md"
              className="shadow-sm"
              data-request-access-state="ready"
              onClick={() => setWriting(true)}
            >
              <KeyGlyph />
              Request Access
            </Button>
          </Tooltip>
        )}
      </div>
      {requested ? (
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          {REQUESTED_LINE}
        </p>
      ) : null}
      {shown ? (
        <form
          data-request-access-state={sending ? 'sending' : 'writing'}
          className="mt-5 w-full animate-pop-in rounded-xl border border-slate-200 bg-slate-50 p-3 text-left motion-reduce:animate-none dark:border-slate-700 dark:bg-slate-800/60"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label
            htmlFor={noteId}
            className="text-xs font-medium text-slate-600 dark:text-slate-300"
          >
            Add a note (optional)
          </label>
          <TextArea
            ref={field}
            id={noteId}
            rows={2}
            maxLength={ACCESS_REQUEST_NOTE_MAX}
            value={note}
            placeholder={`Why you need this ${noun}`}
            onChange={(e) => setNote(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                submit();
              } else if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                cancel();
              }
            }}
            className="mt-1 w-full resize-y"
          />
          <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
            {note.length >= COUNT_FROM ? (
              <span
                aria-live="polite"
                className="mr-auto text-xs tabular-nums text-slate-500 dark:text-slate-400"
              >
                {note.length}/{ACCESS_REQUEST_NOTE_MAX}
              </span>
            ) : null}
            <Button type="button" size="md" variant="ghost" onClick={cancel}>
              Cancel
            </Button>
            <Button type="submit" size="md" busy={sending} className="shadow-sm">
              {sending ? 'Sending…' : 'Send Request'}
            </Button>
          </div>
        </form>
      ) : null}
      {failed && !requested ? (
        <p role="alert" className="mt-3 text-sm text-rose-700 dark:text-rose-300">
          {REQUEST_FAILURE_TEXT[failed]}
        </p>
      ) : null}
    </div>
  );
}
