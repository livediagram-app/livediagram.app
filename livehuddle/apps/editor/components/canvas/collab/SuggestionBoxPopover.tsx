'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import { AnchoredPopover } from '@liveworkspace/workbench/components/primitives/AnchoredPopover';
import { lucideRefreshCw } from '@liveworkspace/icons/lucide';
import type { Suggestion } from '@livehuddle/api-schema';
import { SUGGESTION_TEXT_MAX, type ShapeElement } from '@livehuddle/document';
import { lucideGlyph, Tooltip } from '@livehuddle/ui';
import { useOptionalEditorContext } from '@/app/document/[id]/EditorContext';
import { apiDropSuggestion, apiListSuggestions, apiRemoveSuggestion } from '@/lib/api-client';
import { shortDay } from '@/lib/calendar-month';
import { isOfflineIdSync } from '@/lib/offline/offline-ids';
import { track } from '@/lib/telemetry';
import { ReaderShell } from './ReaderShell';

// A Suggestion Box (docs/specs/009-elements/team-pieces.md "Suggestion Box"): anyone taking part drops an anonymous
// note in; only an Editor reads them. The notes live beside the Space (the api's suggestion routes), never in the
// element or the room, so the box reads and writes only through those, and only while it is open. Who is asking
// decides what it shows: an Editor the notes and the add box, a Participant the add box alone, a Viewer the box shut,
// and a Space kept in This Browser a word on sharing it.

const RefreshIcon = lucideGlyph(lucideRefreshCw, 13);

const SIZES = {
  popover: {
    wrap: 'flex max-h-[min(70vh,540px)] flex-col gap-2.5 p-3',
    field: 'text-[12px]',
    body: 'text-[12px]',
    meta: 'text-[10px]',
    action: 'px-2.5 py-1 text-[11px]',
    note: 'rounded-md px-2.5 py-2',
  },
  reader: {
    wrap: 'flex flex-col gap-3 p-4 sm:p-5',
    field: 'text-[15px]',
    body: 'text-[15px] leading-relaxed',
    meta: 'text-[12px]',
    action: 'px-3 py-1.5 text-[13px]',
    note: 'rounded-lg px-3.5 py-3',
  },
} as const;

type Mode = 'offline' | 'viewer' | 'participant' | 'editor';

export function SuggestionBoxPopover({
  element,
  anchor,
  onClose,
}: {
  element: ShapeElement;
  anchor: HTMLElement;
  onClose: () => void;
}) {
  return (
    <AnchoredPopover anchor={anchor} name="Suggestion Box" width={300} onClose={onClose} pointer>
      <SuggestionBoxPanel element={element} size="popover" />
    </AnchoredPopover>
  );
}

/** The box opened large while walking (docs/specs/008-canvas/avatar-mode.md "The reader"). */
export function SuggestionBoxReader({
  element,
  onClose,
}: {
  element: ShapeElement;
  onClose: () => void;
}) {
  return (
    <ReaderShell
      title={element.label?.trim() || 'Suggestion Box'}
      onClose={onClose}
      data-suggestion-reader
    >
      <SuggestionBoxPanel element={element} size="reader" />
    </ReaderShell>
  );
}

const REFUSED: Record<string, string> = {
  box_full: 'The box is full. An Editor can empty it.',
  box_closed: 'This box is closed.',
};

function refusalOf(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  return (typeof code === 'string' && REFUSED[code]) || "Couldn't drop it. Try again.";
}

export function SuggestionBoxPanel({
  element,
  size,
}: {
  element: ShapeElement;
  size: keyof typeof SIZES;
}) {
  const z = SIZES[size];
  const editor = useOptionalEditorContext();
  const place = editor?.imageContext;
  const tabId = editor?.activeTab.id ?? null;
  const level = editor?.can.level ?? 'view';
  const mode: Mode =
    !place || !tabId || isOfflineIdSync(place.documentId)
      ? 'offline'
      : level === 'edit'
        ? 'editor'
        : level === 'participate'
          ? 'participant'
          : 'viewer';
  const closed = element.locked === true;

  return (
    <div className={`${z.wrap} text-slate-800 dark:text-slate-100`}>
      {size === 'popover' ? <h2 className="text-[13px] font-semibold">Suggestion Box</h2> : null}
      {mode === 'offline' ? (
        <Quiet z={z}>Share this Space to collect suggestions.</Quiet>
      ) : mode === 'viewer' ? (
        <Quiet z={z}>People taking part drop ideas in here, and Editors read them.</Quiet>
      ) : (
        <>
          {closed ? (
            <Quiet z={z}>This box is closed.</Quiet>
          ) : (
            <DropForm
              z={z}
              onDrop={(text) =>
                apiDropSuggestion(
                  place!.ownerId,
                  place!.documentId,
                  tabId!,
                  element.id,
                  text,
                  place!.shareCode,
                ).then(() => track('Element', 'Changed', 'Suggestion-box'))
              }
            />
          )}
          {mode === 'editor' ? (
            <EditorNotes
              z={z}
              load={() =>
                apiListSuggestions(
                  place!.ownerId,
                  place!.documentId,
                  tabId!,
                  element.id,
                  place!.shareCode,
                )
              }
              remove={(id) =>
                apiRemoveSuggestion(place!.ownerId, place!.documentId, tabId!, id, place!.shareCode)
              }
            />
          ) : null}
        </>
      )}
    </div>
  );
}

function Quiet({ z, children }: { z: (typeof SIZES)[keyof typeof SIZES]; children: string }) {
  return (
    <p
      className={`rounded-lg bg-slate-50 px-3 py-2.5 ${z.body} text-slate-600 dark:bg-slate-800/60 dark:text-slate-300`}
    >
      {children}
    </p>
  );
}

type DropStatus =
  { kind: 'idle' } | { kind: 'sending' } | { kind: 'sent' } | { kind: 'failed'; message: string };

function DropForm({
  z,
  onDrop,
}: {
  z: (typeof SIZES)[keyof typeof SIZES];
  onDrop: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState('');
  const [status, setStatus] = useState<DropStatus>({ kind: 'idle' });
  const body = text.trim();
  const sending = status.kind === 'sending';
  const submit = () => {
    if (!body || sending) return;
    setStatus({ kind: 'sending' });
    onDrop(body.slice(0, SUGGESTION_TEXT_MAX)).then(
      () => {
        setText('');
        setStatus({ kind: 'sent' });
      },
      (err: unknown) => setStatus({ kind: 'failed', message: refusalOf(err) }),
    );
  };
  return (
    <form
      className="flex flex-col gap-1.5 rounded-lg border border-slate-200 p-2 dark:border-slate-700"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <textarea
        value={text}
        maxLength={SUGGESTION_TEXT_MAX}
        onChange={(e) => {
          setText(e.target.value);
          if (status.kind !== 'idle' && status.kind !== 'sending') setStatus({ kind: 'idle' });
        }}
        placeholder="Share an idea. Nobody sees who wrote it."
        aria-label="Suggestion"
        rows={4}
        className={`resize-none rounded-md border border-slate-200 bg-white px-2 py-1.5 ${z.field} outline-none focus:border-sky-500 dark:border-slate-600 dark:bg-slate-900`}
      />
      <div className="flex items-center gap-2">
        <span className={`${z.meta} tabular-nums text-slate-500 dark:text-slate-400`}>
          {text.length}/{SUGGESTION_TEXT_MAX}
        </span>
        <button
          type="submit"
          disabled={!body || sending}
          className={`ml-auto cursor-pointer rounded-md bg-sky-600 ${z.action} font-semibold text-white hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-50`}
        >
          {sending ? 'Dropping…' : 'Drop It In'}
        </button>
      </div>
      <p
        role="status"
        className={`${z.meta} ${
          status.kind === 'failed'
            ? 'text-amber-700 dark:text-amber-400'
            : 'text-slate-500 dark:text-slate-400'
        }`}
      >
        {status.kind === 'sent'
          ? 'Dropped in. Only Editors read these, and never who wrote them.'
          : status.kind === 'failed'
            ? status.message
            : 'Anonymous: no name, no time, only the day.'}
      </p>
    </form>
  );
}

type ListStatus = { kind: 'loading' } | { kind: 'ready'; notes: Suggestion[] } | { kind: 'failed' };

function EditorNotes({
  z,
  load,
  remove,
}: {
  z: (typeof SIZES)[keyof typeof SIZES];
  load: () => Promise<Suggestion[]>;
  remove: (id: string) => Promise<void>;
}) {
  // Opens loading: the read starts with the panel, and again on Refresh or Try Again. A drop is not sent live.
  const [status, setStatus] = useState<ListStatus>({ kind: 'loading' });
  const [round, setRound] = useState(0);
  const fetchNotes = useEffectEvent(() => {
    load().then(
      (notes) => setStatus({ kind: 'ready', notes }),
      () => setStatus({ kind: 'failed' }),
    );
  });
  useEffect(() => {
    fetchNotes();
  }, [round]);
  const refresh = () => {
    setStatus({ kind: 'loading' });
    setRound((r) => r + 1);
  };
  const drop = (id: string) => {
    if (status.kind !== 'ready') return;
    const before = status.notes;
    setStatus({ kind: 'ready', notes: before.filter((n) => n.id !== id) });
    remove(id).catch(() => setStatus({ kind: 'ready', notes: before }));
  };
  return (
    <section aria-label="Notes in the box" className="flex min-h-0 flex-col gap-1.5">
      <div className="flex items-center gap-2">
        <h3 className={`${z.body} font-semibold`}>
          In the Box
          {status.kind === 'ready' ? (
            <span className="ml-1.5 font-normal tabular-nums text-slate-500 dark:text-slate-400">
              {status.notes.length}
            </span>
          ) : null}
        </h3>
        <Tooltip label="Refresh">
          <button
            type="button"
            aria-label="Refresh the notes"
            onClick={refresh}
            className="ml-auto flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-sky-500 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <RefreshIcon />
          </button>
        </Tooltip>
      </div>
      {status.kind === 'loading' ? (
        <p className={`${z.meta} py-2 text-slate-500 dark:text-slate-400`}>Opening the box…</p>
      ) : status.kind === 'failed' ? (
        <div className={`flex items-center gap-2 ${z.meta} text-amber-700 dark:text-amber-400`}>
          Couldn&apos;t load the notes.
          <button
            type="button"
            onClick={refresh}
            className="cursor-pointer rounded px-1.5 py-0.5 font-semibold text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Try Again
          </button>
        </div>
      ) : status.notes.length === 0 ? (
        <p className={`py-3 text-center ${z.body} text-slate-500 dark:text-slate-400`}>
          No Notes Yet
        </p>
      ) : (
        <ul className="flex min-h-0 flex-col gap-1.5 overflow-y-auto">
          {status.notes.map((note) => (
            <li
              key={note.id}
              className={`${z.note} border border-amber-200/70 bg-amber-50 text-slate-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-slate-100`}
            >
              <p className={`whitespace-pre-wrap break-words ${z.body}`}>{note.text}</p>
              <div
                className={`mt-1 flex items-center ${z.meta} text-slate-500 dark:text-slate-400`}
              >
                <span>{shortDay(note.day)}</span>
                <button
                  type="button"
                  onClick={() => drop(note.id)}
                  className="ml-auto cursor-pointer rounded px-1 font-semibold text-slate-700 hover:bg-black/10 dark:text-slate-200 dark:hover:bg-white/10"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
