// The Q&A board's composer (spec/151): a field, an Anonymous toggle and a send
// button. Enter posts. The toggle is sticky for the session on purpose: people
// who want to ask anonymously tend to want it for every note, and re-arming
// it per note is how a name slips onto the one note that shouldn't have it.

import { useState } from 'react';
import { QA_MAX_TEXT } from '@livediagram/diagram';
import { Tooltip } from '@/components/primitives/Tooltip';
import { tint } from '../collab-chrome';
import { MaskGlyph, QA_ACCENT, SendGlyph, stopPointer } from './qa-parts';

export function QaComposer({
  textColor,
  selfName,
  onAdd,
}: {
  textColor: string;
  selfName: string;
  onAdd: (text: string, anonymous: boolean) => void;
}) {
  const [draft, setDraft] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const text = draft.trim();
  const left = QA_MAX_TEXT - draft.length;

  const submit = () => {
    if (!text) return;
    onAdd(text, anonymous);
    setDraft('');
  };

  return (
    <div
      className="flex w-full flex-col gap-1.5 rounded-2xl border p-1.5 transition-shadow focus-within:shadow-[0_0_0_3px_var(--qa-accent-soft)]"
      style={{ borderColor: tint(textColor, 0.16), backgroundColor: tint(textColor, 0.03) }}
    >
      <div className="flex items-center gap-1.5">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            // The canvas listens for plain keys (type-to-edit, shortcuts), so
            // every keystroke in here stops at the field.
            e.stopPropagation();
            if (e.key === 'Enter') {
              e.preventDefault();
              submit();
            }
          }}
          {...stopPointer}
          placeholder="Add a note…"
          aria-label="Add a note to the board"
          maxLength={QA_MAX_TEXT}
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
          aria-label="Post note"
          className="pointer-events-auto inline-flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-white transition hover:scale-105 active:scale-95 disabled:cursor-default disabled:opacity-35"
          style={{ backgroundColor: QA_ACCENT }}
        >
          <SendGlyph size={13} />
        </button>
      </div>
      <div className="flex items-center justify-between gap-2 px-1">
        <Tooltip
          title={anonymous ? 'Posting anonymously' : `Posting as ${selfName || 'you'}`}
          description={
            anonymous
              ? 'No name is stored with the note, and nothing goes to the change log.'
              : 'Your name shows on the note. Switch on to post without it.'
          }
        >
          <button
            type="button"
            role="switch"
            aria-checked={anonymous}
            {...stopPointer}
            onClick={(e) => {
              e.stopPropagation();
              setAnonymous((a) => !a);
            }}
            className="pointer-events-auto inline-flex cursor-pointer items-center gap-1.5 rounded-full py-0.5 pl-0.5 pr-2 text-[10px] font-semibold transition"
            style={{
              color: anonymous ? QA_ACCENT : textColor,
              backgroundColor: anonymous ? tint(QA_ACCENT, 0.14) : tint(textColor, 0.06),
            }}
          >
            <span
              className="inline-flex h-4 w-7 items-center rounded-full p-0.5 transition-colors"
              style={{ backgroundColor: anonymous ? QA_ACCENT : tint(textColor, 0.2) }}
            >
              <span
                className="inline-flex h-3 w-3 items-center justify-center rounded-full bg-white text-slate-700 transition-transform duration-200"
                style={{ transform: anonymous ? 'translateX(12px)' : 'none' }}
              >
                {anonymous ? <MaskGlyph size={8} /> : null}
              </span>
            </span>
            {anonymous ? 'Anonymous' : `As ${selfName || 'you'}`}
          </button>
        </Tooltip>
        {left <= 40 ? (
          <span
            className="text-[10px] font-medium tabular-nums"
            style={{ color: left <= 10 ? '#e11d48' : textColor, opacity: left <= 10 ? 1 : 0.5 }}
          >
            {left}
          </span>
        ) : null}
      </div>
    </div>
  );
}
