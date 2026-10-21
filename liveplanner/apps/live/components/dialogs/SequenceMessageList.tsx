'use client';

// The Sequence dialog's Messages tab (docs/specs/009-elements/sequence-diagram.md "The Sequence dialog"): a numbered
// row per message, top to bottom: From, the kind (one button drawn as the arrow it makes), To, the words, and Move
// Up, Move Down and Remove. Enter in the words adds the next message under it, from its receiver to the participant
// after, so a conversation is typed straight down; Backspace in empty words removes the row. Words are stored when
// their box loses focus, everything else at once.

import { useEffect, useRef } from 'react';
import {
  SEQUENCE_KINDS,
  SEQ_MESSAGES_MAX,
  SEQ_MESSAGE_LABEL_MAX,
  type SequenceElementMessage,
  type SequenceElementParticipant,
  type SequenceMessageKindName,
} from '@liveplanner/document';
import { CompactEmptyState, lucideGlyph, Select, Tooltip } from '@liveplanner/ui';
import { lucideChevronDown, lucideChevronUp, lucidePlus, lucideX } from '@liveplanner/icons/lucide';

const UpIcon = lucideGlyph(lucideChevronUp, 15);
const DownIcon = lucideGlyph(lucideChevronDown, 15);
const PlusIcon = lucideGlyph(lucidePlus, 14);
const RemoveIcon = lucideGlyph(lucideX, 14);

export const KIND_NAME: Record<SequenceMessageKindName, string> = {
  call: 'Call',
  async: 'Async',
  reply: 'Reply',
};
const KIND_HINT: Record<SequenceMessageKindName, string> = {
  call: 'Call: waits for an answer',
  async: 'Async: nobody waits',
  reply: 'Reply: the answer back',
};

/** The arrow a kind draws: solid with a filled head, solid with an open head, dashed with an open head. */
function KindArrow({ kind }: { kind: SequenceMessageKindName }) {
  return (
    <svg aria-hidden viewBox="0 0 28 12" className="h-3 w-7" fill="none" stroke="currentColor">
      <path
        d="M2 6h21"
        strokeWidth={1.6}
        strokeDasharray={kind === 'reply' ? '3 2.5' : undefined}
        strokeLinecap="round"
      />
      {kind === 'call' ? (
        <path d="M20 2.5 26 6l-6 3.5Z" fill="currentColor" stroke="none" />
      ) : (
        <path d="M20.5 2.5 26 6l-5.5 3.5" strokeWidth={1.6} strokeLinecap="round" />
      )}
    </svg>
  );
}

const WORDS =
  'h-9 w-full min-w-0 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-brand-400 focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-400 dark:focus:ring-brand-500/30';
const ROW_TOOL =
  'touch-target relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-slate-400 transition enabled:hover:bg-slate-100 enabled:hover:text-slate-700 disabled:cursor-default disabled:opacity-30 dark:enabled:hover:bg-slate-800 dark:enabled:hover:text-slate-200';
// Move Up and Move Down show on a row's hover or focus with a mouse, and always on a touch screen. On a phone the
// words and these tools take a second line, so From and To share the first line at equal widths.
const REVEAL =
  'opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 [@media(hover:none)]:opacity-100';
const ADD_ROW =
  'flex w-full items-center gap-1.5 rounded-lg border border-dashed border-slate-300 bg-white/60 px-3 py-2 text-left text-[13px] font-medium text-slate-600 transition enabled:cursor-pointer enabled:hover:border-brand-400 enabled:hover:bg-brand-50 enabled:hover:text-brand-700 disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-300 dark:enabled:hover:border-brand-500/60 dark:enabled:hover:bg-brand-500/15 dark:enabled:hover:text-brand-200';

export function SequenceMessageList({
  participants,
  messages,
  onDraft,
  onCommit,
  onAddAfter,
  focusRow,
  onFocused,
}: {
  participants: SequenceElementParticipant[];
  messages: SequenceElementMessage[];
  // A change while typing (redraws the preview); nothing is stored until onCommit.
  onDraft: (next: SequenceElementMessage[]) => void;
  // Store these messages; `focus` puts the cursor in that row's words once it renders.
  onCommit: (next: SequenceElementMessage[], focus?: number) => void;
  // Add the next message after row `index` (-1 for the first), as Enter does.
  onAddAfter: (index: number) => void;
  // The row whose words take the cursor once it renders, then onFocused clears it.
  focusRow: number | null;
  onFocused: () => void;
}) {
  const words = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => {
    if (focusRow === null) return;
    const box = words.current[focusRow];
    if (!box) return;
    box.focus();
    box.setSelectionRange(box.value.length, box.value.length);
    onFocused();
  }, [focusRow, messages, onFocused]);

  const set = (i: number, patch: Partial<SequenceElementMessage>) =>
    messages.map((m, j) => (j === i ? { ...m, ...patch } : m));
  const move = (i: number, to: number) => {
    if (to < 0 || to >= messages.length) return;
    const next = [...messages];
    [next[i], next[to]] = [next[to]!, next[i]!];
    onCommit(next);
  };
  const nameOf = (id: string) => participants.find((p) => p.id === id)?.label || id;
  const full = messages.length >= SEQ_MESSAGES_MAX;

  return (
    <section aria-label="Messages" data-tour-id="sequence-messages">
      <p className="mb-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
        Messages <span className="font-normal">· top to bottom; Enter adds the next</span>
      </p>
      {messages.length === 0 ? (
        <CompactEmptyState
          size="small"
          icon={<KindArrow kind="call" />}
          title="No messages yet"
          description="Add the first one: who calls whom, and what they say."
          className="mb-2 rounded-lg border border-slate-100 dark:border-slate-800"
        />
      ) : (
        <ol className="flex flex-col gap-1.5">
          {messages.map((m, i) => {
            const n = i + 1;
            const next: SequenceMessageKindName =
              SEQUENCE_KINDS[(SEQUENCE_KINDS.indexOf(m.kind) + 1) % SEQUENCE_KINDS.length]!;
            return (
              <li
                key={i}
                className="group grid grid-cols-[1.25rem_minmax(0,1fr)_2.5rem_minmax(0,1fr)] items-center gap-x-1.5 gap-y-1.5 rounded-lg px-1 py-1 transition hover:bg-slate-50 focus-within:bg-slate-50 sm:grid-cols-[1.25rem_6.5rem_2.5rem_6.5rem_minmax(0,1fr)_auto] dark:hover:bg-slate-800/50 dark:focus-within:bg-slate-800/50"
              >
                <span
                  aria-hidden
                  className="text-right text-xs font-medium tabular-nums text-slate-500 dark:text-slate-400"
                >
                  {n}
                </span>
                {(['from', 'to'] as const).map((end) => (
                  <Select
                    key={end}
                    className={`min-w-0 ${end === 'to' ? 'order-4' : 'order-2'}`}
                    selectClassName="h-9 !text-sm"
                    aria-label={`Message ${n} ${end}`}
                    value={m[end]}
                    onChange={(e) => onCommit(set(i, { [end]: e.target.value }))}
                  >
                    {participants.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.label || p.id}
                      </option>
                    ))}
                  </Select>
                ))}
                <Tooltip label={`${KIND_HINT[m.kind]}. Click For ${KIND_NAME[next]}`}>
                  <button
                    type="button"
                    aria-label={`Message ${n} kind: ${KIND_NAME[m.kind]}. Change to ${KIND_NAME[next]}`}
                    // The first message's kind, where the Sequence tour points (docs/specs/007-editor/element-tours.md).
                    data-tour-id={i === 0 ? 'sequence-kind' : undefined}
                    onClick={() => onCommit(set(i, { kind: next }))}
                    className={`order-3 flex h-9 cursor-pointer items-center justify-center rounded-md border transition ${
                      m.kind === 'reply'
                        ? 'border-slate-200 text-slate-500 hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:text-slate-400'
                        : 'border-brand-200 bg-brand-50 text-brand-700 hover:border-brand-400 dark:border-brand-500/40 dark:bg-brand-500/15 dark:text-brand-200'
                    }`}
                  >
                    <KindArrow kind={m.kind} />
                  </button>
                </Tooltip>
                <input
                  ref={(el) => {
                    words.current[i] = el;
                  }}
                  className={`${WORDS} order-5 col-span-2 col-start-2 sm:col-span-1 sm:col-start-auto`}
                  value={m.label}
                  maxLength={SEQ_MESSAGE_LABEL_MAX}
                  placeholder={
                    m.from === m.to
                      ? `What ${nameOf(m.from)} does itself`
                      : `What ${nameOf(m.from)} says to ${nameOf(m.to)}`
                  }
                  aria-label={`Message ${n} words`}
                  onChange={(e) => onDraft(set(i, { label: e.target.value }))}
                  onBlur={() => onCommit(messages)}
                  onKeyDown={(e) => {
                    if (e.nativeEvent.isComposing) return;
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onAddAfter(i);
                    } else if (e.key === 'Backspace' && m.label === '' && messages.length > 0) {
                      e.preventDefault();
                      onCommit(
                        messages.filter((_, j) => j !== i),
                        i > 0 ? i - 1 : undefined,
                      );
                    }
                  }}
                />
                <div className="order-6 flex items-center justify-end">
                  <span className={`flex ${REVEAL}`}>
                    <button
                      type="button"
                      aria-label={`Move message ${n} up`}
                      disabled={i === 0}
                      onClick={() => move(i, i - 1)}
                      className={ROW_TOOL}
                    >
                      <UpIcon />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move message ${n} down`}
                      disabled={i === messages.length - 1}
                      onClick={() => move(i, i + 1)}
                      className={ROW_TOOL}
                    >
                      <DownIcon />
                    </button>
                  </span>
                  <button
                    type="button"
                    aria-label={`Remove message ${n}`}
                    onClick={() => onCommit(messages.filter((_, j) => j !== i))}
                    className={`${ROW_TOOL} enabled:hover:text-rose-600`}
                  >
                    <RemoveIcon />
                  </button>
                </div>
              </li>
            );
          })}
        </ol>
      )}
      <button
        type="button"
        disabled={full}
        onClick={() => onAddAfter(messages.length - 1)}
        className={`${ADD_ROW} mt-2`}
        data-tour-id="sequence-add-message"
      >
        <PlusIcon />
        Add Message
        <span className="ml-auto text-[11px] font-normal tabular-nums text-slate-500 dark:text-slate-400">
          {messages.length} of {SEQ_MESSAGES_MAX}
        </span>
      </button>
    </section>
  );
}
