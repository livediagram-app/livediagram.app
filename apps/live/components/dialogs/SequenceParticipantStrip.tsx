'use client';

// The Sequence dialog's participant strip (docs/specs/009-elements/sequence-diagram.md "The Sequence dialog"): every
// participant as a chip, left to right as the diagram draws them, with its look's glyph. Clicking one opens it in
// place under the strip: its name, Actor, Move Left, Move Right and Remove. A dashed Add Participant chip ends the
// strip. Every change here is structural, so it is stored at once (the name on Enter or when its box loses focus).

import { useEffect, useRef, useState } from 'react';
import {
  SEQ_PARTICIPANTS_MAX,
  SEQ_PARTICIPANTS_MIN,
  SEQ_PARTICIPANT_LABEL_MAX,
  type SequenceElementParticipant,
} from '@livediagram/document';
import { lucideGlyph, SOLID_BRAND_DARK, Tooltip } from '@livediagram/ui';
import {
  lucideChevronLeft,
  lucideChevronRight,
  lucidePlus,
  lucideTrash2,
} from '@livediagram/icons/lucide';

const LeftIcon = lucideGlyph(lucideChevronLeft, 15);
const RightIcon = lucideGlyph(lucideChevronRight, 15);
const PlusIcon = lucideGlyph(lucidePlus, 14);
const RemoveIcon = lucideGlyph(lucideTrash2, 14);

/** A participant's look: a headed box, or a stick figure for an actor. */
export function ParticipantGlyph({ actor }: { actor?: boolean }) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
    >
      {actor ? (
        <path d="M8 2.2a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6ZM8 5.8v5M4.5 7.5h7M8 10.8l-3 3.5M8 10.8l3 3.5" />
      ) : (
        <>
          <rect x="2" y="2.5" width="12" height="6" rx="1.5" />
          <path d="M8 8.5v6" strokeDasharray="1.6 1.6" />
        </>
      )}
    </svg>
  );
}

const CHIP =
  'inline-flex h-8 max-w-[13rem] cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[13px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400';
const CHIP_IDLE =
  'border-slate-200 bg-white text-slate-700 hover:border-brand-300 hover:bg-brand-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:border-brand-500/60 dark:hover:bg-brand-500/15';
const CHIP_OPEN =
  'border-brand-400 bg-brand-50 text-brand-800 ring-2 ring-brand-200 dark:border-brand-500/70 dark:bg-brand-500/15 dark:text-brand-100 dark:ring-brand-500/30';
const TOOL =
  'touch-target relative flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-slate-500 transition enabled:hover:bg-white enabled:hover:text-slate-800 disabled:cursor-default disabled:opacity-35 dark:text-slate-400 dark:enabled:hover:bg-slate-700 dark:enabled:hover:text-slate-100';

export function SequenceParticipantStrip({
  participants,
  messageCount,
  onChange,
}: {
  participants: SequenceElementParticipant[];
  // How many messages each participant is in, so Remove can say what it takes with it.
  messageCount: (id: string) => number;
  // Store these participants (structural: at once).
  onChange: (next: SequenceElementParticipant[]) => void;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const nameRef = useRef<HTMLInputElement>(null);
  // A chip just added opens with its name selected, ready to type over.
  const selectOnOpen = useRef(false);
  const open = participants.find((p) => p.id === openId) ?? null;
  const at = open ? participants.indexOf(open) : -1;

  useEffect(() => {
    if (!open || !selectOnOpen.current) return;
    selectOnOpen.current = false;
    nameRef.current?.select();
  }, [open]);

  const show = (p: SequenceElementParticipant) => {
    if (openId === p.id) return setOpenId(null);
    setDraft(p.label);
    setOpenId(p.id);
  };
  // The participants with the name being typed applied: a click on Actor, a move or Remove lands after the name box's
  // blur has stored it, but before this render sees that, so each acts on this rather than the props alone.
  const current = () => {
    const label = draft.replace(/\s+/g, ' ').trim();
    return participants.map((p) => (p.id === openId && label ? { ...p, label } : p));
  };
  const patch = (fn: (p: SequenceElementParticipant) => SequenceElementParticipant) =>
    onChange(current().map((p) => (p.id === openId ? fn(p) : p)));
  const saveName = () => {
    const label = draft.replace(/\s+/g, ' ').trim();
    if (open && label && label !== open.label) patch((p) => p);
    else if (open) setDraft(open.label);
  };
  const move = (step: -1 | 1) => {
    const to = at + step;
    if (at < 0 || to < 0 || to >= participants.length) return;
    const next = current();
    [next[at], next[to]] = [next[to]!, next[at]!];
    onChange(next);
  };
  const add = () => {
    if (participants.length >= SEQ_PARTICIPANTS_MAX) return;
    const ids = new Set(participants.map((p) => p.id));
    let n = participants.length + 1;
    while (ids.has(`p${n}`)) n++;
    // A name no other participant has, so the From and To pickers and the Text tab tell them apart.
    const labels = new Set(participants.map((p) => p.label.toLowerCase()));
    let k = participants.length + 1;
    while (labels.has(`participant ${k}`)) k++;
    const label = `Participant ${k}`;
    onChange([...participants, { id: `p${n}`, label }]);
    selectOnOpen.current = true;
    setDraft(label);
    setOpenId(`p${n}`);
  };

  const uses = open ? messageCount(open.id) : 0;
  return (
    <section aria-label="Participants" className="mb-4" data-tour-id="sequence-participants">
      <p className="mb-1.5 text-[11px] font-medium text-slate-500 dark:text-slate-400">
        Participants <span className="font-normal">· left to right; click one to change it</span>
      </p>
      <ul className="flex flex-wrap gap-1.5">
        {participants.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              aria-expanded={openId === p.id}
              aria-label={`${p.label || p.id}${p.actor ? ', actor' : ''}`}
              onClick={() => show(p)}
              className={`${CHIP} ${openId === p.id ? CHIP_OPEN : CHIP_IDLE}`}
            >
              <ParticipantGlyph actor={p.actor} />
              <span className="text-optical-line truncate">{p.label || p.id}</span>
            </button>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={add}
            disabled={participants.length >= SEQ_PARTICIPANTS_MAX}
            className={`${CHIP} border-dashed border-slate-300 bg-white/60 text-slate-600 enabled:hover:border-brand-400 enabled:hover:bg-brand-50 enabled:hover:text-brand-700 disabled:cursor-default disabled:opacity-40 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-300 dark:enabled:hover:border-brand-500/60 dark:enabled:hover:bg-brand-500/15 dark:enabled:hover:text-brand-200`}
          >
            <PlusIcon />
            Add Participant
          </button>
        </li>
      </ul>
      {open ? (
        <div
          role="group"
          aria-label={`Change ${open.label || open.id}`}
          className="mt-2 flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-700 dark:bg-slate-800/60"
        >
          <input
            ref={nameRef}
            autoFocus
            className="h-8 min-w-0 flex-1 basis-40 rounded-md border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none transition focus:border-brand-400 focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-brand-500/30"
            value={draft}
            maxLength={SEQ_PARTICIPANT_LABEL_MAX}
            aria-label="Participant name"
            onChange={(e) => setDraft(e.target.value)}
            onBlur={saveName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                saveName();
                setOpenId(null);
              } else if (e.key === 'Escape') {
                // Cancel the rename, not the dialog.
                e.preventDefault();
                e.stopPropagation();
                setDraft(open.label);
                setOpenId(null);
              }
            }}
          />
          <div
            role="radiogroup"
            aria-label="Look"
            className="flex rounded-md border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800"
          >
            {[false, true].map((actor) => {
              const on = !!open.actor === actor;
              return (
                <button
                  key={String(actor)}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => !on && patch((p) => ({ ...p, actor: actor || undefined }))}
                  className={`flex h-7 cursor-pointer items-center gap-1.5 rounded px-2 text-xs font-medium transition ${
                    on
                      ? `bg-brand-700 text-white ${SOLID_BRAND_DARK}`
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700'
                  }`}
                >
                  <ParticipantGlyph actor={actor} />
                  {actor ? 'Actor' : 'Box'}
                </button>
              );
            })}
          </div>
          <div className="flex items-center">
            <Tooltip label="Move Left">
              <button
                type="button"
                aria-label="Move left"
                disabled={at <= 0}
                onClick={() => move(-1)}
                className={TOOL}
              >
                <LeftIcon />
              </button>
            </Tooltip>
            <Tooltip label="Move Right">
              <button
                type="button"
                aria-label="Move right"
                disabled={at >= participants.length - 1}
                onClick={() => move(1)}
                className={TOOL}
              >
                <RightIcon />
              </button>
            </Tooltip>
            <Tooltip
              label={
                participants.length <= SEQ_PARTICIPANTS_MIN
                  ? 'A Diagram Needs Two Participants'
                  : uses > 0
                    ? `Remove, With ${uses} ${uses === 1 ? 'Message' : 'Messages'}`
                    : 'Remove'
              }
            >
              <button
                type="button"
                aria-label={`Remove ${open.label || open.id}`}
                disabled={participants.length <= SEQ_PARTICIPANTS_MIN}
                onClick={() => {
                  setOpenId(null);
                  onChange(current().filter((p) => p.id !== open.id));
                }}
                className={`${TOOL} enabled:hover:!text-rose-600`}
              >
                <RemoveIcon />
              </button>
            </Tooltip>
          </div>
        </div>
      ) : null}
    </section>
  );
}
