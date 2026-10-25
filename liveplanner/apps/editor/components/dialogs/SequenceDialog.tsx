'use client';

// The Sequence dialog (docs/specs/009-elements/sequence-diagram.md "The Sequence dialog"): a sequence diagram's
// participants as a strip of chips, its messages as numbered rows or as text, and a live preview. Opened by
// double-clicking the diagram or the menu's Edit Sequence; on a phone it rises from the bottom as a sheet.
//
// The dialog owns a draft while open (seeded once; re-seeding on every store echo would fight the typing). The
// preview redraws from the draft as you type; the diagram behind redraws when a change is stored, words on blur and
// anything structural at once, one undo step each. A store that would change nothing is skipped.

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button, DialogCloseButton, DialogHeader } from '@liveplanner/ui';
import {
  nextMessageAfter,
  parseSequenceText,
  SEQ_MESSAGES_MAX,
  SEQ_PARTICIPANTS_MIN,
  sequenceDrawing,
  sequenceToText,
  type SequenceElementMessage,
  type SequenceElementParticipant,
  type ShapeElement,
} from '@liveplanner/project';
import { Dialog } from '@/components/dialogs/Dialog';
import { DialogTabs } from '@liveworkspace/workbench/components/dialogs/DialogTabs';
import { useLatest } from '@liveworkspace/workbench/hooks/ui/useLatest';
import { registerSequenceDialog } from '@/lib/sequence-dialog-handle';
import { HelpArticleLink } from '@/components/primitives/HelpArticleLink';
import { SequenceFace } from '@/components/canvas/SequenceFace';
import { SequenceParticipantStrip } from '@/components/dialogs/SequenceParticipantStrip';
import { SequenceMessageList } from '@/components/dialogs/SequenceMessageList';
import { ToggleSwitch } from '@/components/palette/palette-controls';

type Tab = 'messages' | 'text';
const TABS: readonly Tab[] = ['messages', 'text'];
const TAB_LABEL: Record<Tab, string> = { messages: 'Messages', text: 'Text' };
// The preview is drawn on white whatever the appearance, so it keeps one ground.
const PREVIEW_PAPER = '#ffffff';

export type SequenceRows = {
  participants: SequenceElementParticipant[];
  messages: SequenceElementMessage[];
};

const known = (participants: readonly SequenceElementParticipant[]) =>
  new Set(participants.map((p) => p.id));
// Messages that still name two participants (a removed participant takes its messages with it).
const keepKnown = (
  participants: SequenceElementParticipant[],
  messages: SequenceElementMessage[],
) => {
  const ids = known(participants);
  return messages.filter((m) => ids.has(m.from) && ids.has(m.to));
};

export function SequenceDialog({
  element,
  onCommit,
  onNumbered,
  onClose,
}: {
  element: ShapeElement;
  // Store these rows; `type` names what changed for telemetry.
  onCommit: (
    rows: SequenceRows,
    type: 'SequenceParticipants' | 'SequenceMessages' | 'SequenceText',
  ) => void;
  onNumbered: (numbered: boolean) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>('messages');
  const [participants, setParticipants] = useState<SequenceElementParticipant[]>(
    () => element.sequenceParticipants ?? [],
  );
  const [messages, setMessages] = useState<SequenceElementMessage[]>(
    () => element.sequenceMessages ?? [],
  );
  const [text, setText] = useState('');
  const [unread, setUnread] = useState<number[]>([]);
  const [tooFew, setTooFew] = useState(false);
  const [focusRow, setFocusRow] = useState<number | null>(null);
  const lastStored = useRef(JSON.stringify([participants, messages]));

  const store = (
    nextP: SequenceElementParticipant[],
    nextM: SequenceElementMessage[],
    type: 'SequenceParticipants' | 'SequenceMessages' | 'SequenceText',
  ) => {
    const m = keepKnown(nextP, nextM);
    setParticipants(nextP);
    setMessages(m);
    const key = JSON.stringify([nextP, m]);
    if (key === lastStored.current) return;
    lastStored.current = key;
    onCommit({ participants: nextP, messages: m }, type);
  };
  const storeMessages = (next: SequenceElementMessage[], focus?: number) => {
    store(participants, next, 'SequenceMessages');
    if (focus !== undefined) setFocusRow(focus);
  };
  // Closing stores what is being typed: Escape unmounts the dialog without blurring the focused box.
  const close = () => {
    store(participants, messages, tab === 'text' ? 'SequenceText' : 'SequenceMessages');
    onClose();
  };

  const addAfter = (index: number) => {
    if (messages.length >= SEQ_MESSAGES_MAX) return;
    const next = [...messages];
    const fresh = nextMessageAfter(
      { ...element, sequenceParticipants: participants, sequenceMessages: messages },
      index,
    );
    next.splice(index + 1, 0, fresh);
    storeMessages(next, index + 1);
  };

  const switchTab = (next: Tab) => {
    if (next === tab) return;
    if (next === 'text') {
      setText(sequenceToText(participants, messages));
      setUnread([]);
      setTooFew(false);
    } else {
      store(participants, messages, 'SequenceText');
    }
    setTab(next);
  };

  // Text as it is typed: read into the draft (the preview follows), stored when the box loses focus. Fewer than two
  // participants is not a diagram, so the draft keeps its last good rows and says why.
  const onText = (value: string) => {
    setText(value);
    const parsed = parseSequenceText(value, participants);
    setUnread(parsed.unread);
    const few = parsed.participants.length < SEQ_PARTICIPANTS_MIN;
    setTooFew(few);
    if (few) return;
    setParticipants(parsed.participants);
    setMessages(parsed.messages);
  };

  const onFocused = useCallback(() => setFocusRow(null), []);
  const messageCount = (id: string) => messages.filter((m) => m.from === id || m.to === id).length;

  const preview = useMemo(() => {
    const el = {
      ...element,
      sequenceParticipants: participants,
      sequenceMessages: keepKnown(participants, messages),
      sequenceAnim: undefined,
    } as ShapeElement;
    // The drawing's own width and height: the last two numbers of its viewBox (a linear match, as svgSequencePicture
    // reads it).
    const drawing = sequenceDrawing(el, { paper: PREVIEW_PAPER });
    const box = /viewBox="([^"]+)"/.exec(drawing.slice(0, drawing.indexOf('>')))?.[1]?.split(' ');
    const [w, h] = box && box.length === 4 ? box.slice(2) : [];
    return { el, ratio: w && h ? `${w} / ${h}` : '16 / 10' };
  }, [element, participants, messages]);

  // The Sequence element tour runs steps inside this dialog (docs/specs/007-editor/element-tours.md "The Sequence
  // tour"): it switches the tabs and closes it at its end through this handle, and while it runs Escape is its own.
  const switchTabRef = useLatest(switchTab);
  const closeRef = useLatest(close);
  useLayoutEffect(
    () =>
      registerSequenceDialog({
        showMessages: () => switchTabRef.current('messages'),
        showText: () => switchTabRef.current('text'),
        close: () => closeRef.current(),
      }),
    [switchTabRef, closeRef],
  );

  return (
    <Dialog
      open
      onClose={close}
      ariaLabel="Edit sequence diagram"
      size="3xl"
      phoneSheet
      className="max-h-[90vh]"
    >
      <DialogHeader
        title="Sequence Diagram"
        subtitle="Who calls whom, in order. Write the messages top to bottom and the diagram lays itself out."
      >
        <HelpArticleLink article="sequenceDiagram" variant="labelled" />
        <DialogCloseButton onClick={close} />
      </DialogHeader>

      <DialogTabs
        tabs={TABS}
        labels={TAB_LABEL}
        value={tab}
        onChange={switchTab}
        idPrefix="sequence"
        ariaLabel="Edit the sequence as"
      />

      {/* The preview above the rows on a phone, beside them on a wide screen. By `order`, not a reversed column: a
          reversed column starts its scroll at the bottom, so the dialog would open on its last row. */}
      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto overflow-x-hidden px-6 py-4 max-sm:px-4 md:flex-row">
        <div className="order-2 min-w-0 flex-1 md:order-1">
          {tab === 'messages' ? (
            <div
              id="sequence-panel-messages"
              role="tabpanel"
              aria-labelledby="sequence-tab-messages"
            >
              <SequenceParticipantStrip
                participants={participants}
                messageCount={messageCount}
                onChange={(next) => store(next, messages, 'SequenceParticipants')}
              />
              <SequenceMessageList
                participants={participants}
                messages={messages}
                onDraft={setMessages}
                onCommit={storeMessages}
                onAddAfter={addAfter}
                focusRow={focusRow}
                onFocused={onFocused}
              />
            </div>
          ) : (
            <div
              id="sequence-panel-text"
              role="tabpanel"
              aria-labelledby="sequence-tab-text"
              data-tour-id="sequence-text"
            >
              <textarea
                className="h-72 w-full resize-y rounded-md border border-slate-200 bg-white px-3 py-2 font-mono text-[13px] leading-relaxed text-slate-800 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-200 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:focus:ring-brand-500/30"
                value={text}
                spellCheck={false}
                aria-label="The sequence, one line each"
                aria-describedby="sequence-text-help"
                placeholder={
                  'actor Customer\nCustomer -> Shop: Place order\nShop --> Customer: Receipt'
                }
                onChange={(e) => onText(e.target.value)}
                onBlur={() => store(participants, messages, 'SequenceText')}
              />
              <p
                id="sequence-text-help"
                className="mt-1.5 text-xs leading-relaxed text-slate-500 dark:text-slate-400"
              >
                One message per line: <code className="font-mono">From -&gt; To: words</code> for a
                call, <code className="font-mono">~&gt;</code> for async,{' '}
                <code className="font-mono">--&gt;</code> for a reply.{' '}
                <code className="font-mono">participant Name</code> or{' '}
                <code className="font-mono">actor Name</code> sets the order; lines starting with{' '}
                <code className="font-mono">//</code> are notes.
              </p>
              {unread.length > 0 || tooFew ? (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400" role="status">
                  {tooFew ? 'A diagram needs two participants. ' : ''}
                  {unread.length === 1
                    ? `Line ${unread[0]} was not read.`
                    : unread.length > 1
                      ? `Lines ${unread.slice(0, 6).join(', ')}${unread.length > 6 ? '…' : ''} were not read.`
                      : ''}
                </p>
              ) : null}
            </div>
          )}
        </div>
        <figure
          data-tour-id="sequence-preview"
          className="order-1 shrink-0 md:sticky md:top-0 md:order-2 md:w-[280px] md:self-start"
        >
          <div
            // Short on a phone, so the rows are in view under it.
            className="relative mx-auto max-h-[360px] w-full max-w-[280px] overflow-hidden rounded-lg border border-slate-200 bg-white max-sm:max-h-40 dark:border-slate-700"
            style={{ aspectRatio: preview.ratio }}
          >
            <SequenceFace element={preview.el} paper={PREVIEW_PAPER} />
          </div>
          <figcaption className="mt-1.5 text-center text-[11px] text-slate-500 dark:text-slate-400">
            Preview, as you type.
          </figcaption>
        </figure>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-6 py-4 max-sm:px-4 dark:border-slate-800">
        <label
          data-tour-id="sequence-numbered"
          className="flex cursor-pointer items-center gap-2.5 text-[13px] text-slate-700 dark:text-slate-200"
        >
          <ToggleSwitch
            checked={element.sequenceNumbered === true}
            onChange={() => onNumbered(element.sequenceNumbered !== true)}
            label="Numbered"
          />
          Numbered
        </label>
        <Button variant="primary" size="md" onClick={close}>
          Done
        </Button>
      </div>
    </Dialog>
  );
}
