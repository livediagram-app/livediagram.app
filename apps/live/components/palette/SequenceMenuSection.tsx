'use client';

import { useEffect, useRef, useState } from 'react';
import {
  DEFAULT_ANIMATION_SPEED,
  SEQUENCE_KINDS,
  SEQ_MESSAGES_MAX,
  SEQ_MESSAGE_LABEL_MAX,
  SEQ_PARTICIPANTS_MAX,
  SEQ_PARTICIPANTS_MIN,
  SEQ_PARTICIPANT_LABEL_MAX,
  nextMessageAfter,
  withSequenceAnim,
  withSequenceNumbered,
  withSequenceRows,
  type SequenceElementMessage,
  type SequenceElementParticipant,
  type SequenceMessageKindName,
  type ShapeElement,
} from '@livediagram/document';
import { Glyph, Select } from '@livediagram/ui';
import { MenuAccordionSection } from '@/components/primitives/PortalMenu';
import { DataMenuGlyph } from '@/components/palette/context-menu-data-rows';
import { BorderGrid, MenuToggleRow } from '@/components/palette/context-menu-rows';
import { SizeButton } from '@/components/palette/palette-controls';
import {
  SpeedAndRepeatRows,
  TileLabel,
  useSpeedRowGate,
} from '@/components/palette/context-menu-tiles';
import { RowControls, move } from '@/components/palette/context-menu-web-editors';
import { MENU_ADD_ROW_BUTTON, MENU_CELL_INPUT } from './menu-editor-classes';
import type { ElementStyleOps } from '@/lib/element-style-ops';

const KIND_LABEL: Record<SequenceMessageKindName, string> = {
  call: 'Call',
  async: 'Async',
  reply: 'Reply',
};

const SUBHEAD =
  'px-2 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400';

function PlayIcon({ on }: { on: boolean }) {
  return (
    <Glyph size={16} units={18}>
      {on ? <path d="M3 4h12M3 9h9M3 14h6" /> : <path d="M4 14 14 4" />}
    </Glyph>
  );
}

// A sequence diagram's section (docs/specs/009-elements/sequence-diagram.md "Editing"): its participants and messages
// as rows, Numbered and Play. Words commit on blur; Enter in a message's label commits it and adds the next message
// under it (from its receiver to the participant after), focused, so a conversation is typed straight down.
export function SequenceMenuSection({
  target,
  ops,
  sectionProps,
}: {
  target: ShapeElement;
  ops: ElementStyleOps;
  sectionProps: (id: string) => { open: boolean; onToggle: () => void; flush: boolean };
}) {
  const [people, setPeople] = useState<SequenceElementParticipant[]>(
    target.sequenceParticipants ?? [],
  );
  const [messages, setMessages] = useState<SequenceElementMessage[]>(target.sequenceMessages ?? []);
  // Re-seed from the element when it changes from elsewhere (an undo, a peer), during render rather than in an effect.
  const [seenPeople, setSeenPeople] = useState(target.sequenceParticipants);
  if (seenPeople !== target.sequenceParticipants) {
    setSeenPeople(target.sequenceParticipants);
    setPeople(target.sequenceParticipants ?? []);
  }
  const [seenMessages, setSeenMessages] = useState(target.sequenceMessages);
  if (seenMessages !== target.sequenceMessages) {
    setSeenMessages(target.sequenceMessages);
    setMessages(target.sequenceMessages ?? []);
  }
  const focusAt = useRef<number | null>(null);
  const labelRefs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => {
    if (focusAt.current === null) return;
    labelRefs.current[focusAt.current]?.focus();
    focusAt.current = null;
  }, [messages]);

  const commitPeople = (next: SequenceElementParticipant[]) =>
    ops.commit((el) => withSequenceRows(el, { participants: next }), 'SequenceParticipants');
  const commitMessages = (next: SequenceElementMessage[]) =>
    ops.commit((el) => withSequenceRows(el, { messages: next }), 'SequenceMessages');
  const setMessage = (i: number, patch: Partial<SequenceElementMessage>) =>
    setMessages((m) => m.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const addAfter = (i: number) => {
    if (messages.length >= SEQ_MESSAGES_MAX) return;
    const next = [...messages];
    next.splice(i + 1, 0, nextMessageAfter({ ...target, sequenceMessages: messages }, i));
    focusAt.current = i + 1;
    setMessages(next);
    commitMessages(next);
  };

  const play = target.sequenceAnim === 'play' ? ('play' as const) : null;
  const { showSpeed, handleSet } = useSpeedRowGate<'play'>(play, (v) =>
    ops.commit((el) => withSequenceAnim(el, { anim: v }), 'SequenceAnim'),
  );

  return (
    <MenuAccordionSection title="Sequence" icon={<DataMenuGlyph />} {...sectionProps('sequence')}>
      <div className={SUBHEAD}>Participants</div>
      <div className="flex flex-col gap-1 px-2">
        {people.map((p, i) => (
          <div key={p.id} className="flex items-center gap-1">
            <input
              className={`${MENU_CELL_INPUT} flex-1`}
              value={p.label}
              placeholder="Name"
              aria-label={`Participant ${i + 1} name`}
              maxLength={SEQ_PARTICIPANT_LABEL_MAX}
              onChange={(e) =>
                setPeople((r) => r.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))
              }
              onBlur={() => commitPeople(people)}
            />
            <button
              type="button"
              aria-pressed={!!p.actor}
              aria-label={`Participant ${i + 1} is an actor`}
              onClick={() =>
                commitPeople(people.map((x, j) => (j === i ? { ...x, actor: !x.actor } : x)))
              }
              className={`rounded px-1 text-[10px] ${
                p.actor
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-200'
                  : 'text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              Actor
            </button>
            <RowControls
              index={i}
              count={people.length}
              min={SEQ_PARTICIPANTS_MIN}
              noun="participant"
              onMove={(to) => commitPeople(move(people, i, to))}
              onRemove={() => commitPeople(people.filter((_, j) => j !== i))}
            />
          </div>
        ))}
        <button
          type="button"
          disabled={people.length >= SEQ_PARTICIPANTS_MAX}
          onClick={() =>
            commitPeople([
              ...people,
              { id: `p${Date.now().toString(36)}`, label: `Participant ${people.length + 1}` },
            ])
          }
          className={MENU_ADD_ROW_BUTTON}
        >
          Add Participant
        </button>
      </div>
      <div className={SUBHEAD}>Messages</div>
      <div className="flex flex-col gap-1 px-2">
        {messages.map((m, i) => (
          <div key={i} className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1">
              {(['from', 'to'] as const).map((end) => (
                <Select
                  key={end}
                  size="sm"
                  className="min-w-0 flex-1"
                  aria-label={`Message ${i + 1} ${end === 'from' ? 'from' : 'to'}`}
                  value={m[end]}
                  onChange={(e) =>
                    commitMessages(
                      messages.map((x, j) => (j === i ? { ...x, [end]: e.target.value } : x)),
                    )
                  }
                >
                  {people.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label || p.id}
                    </option>
                  ))}
                </Select>
              ))}
              <Select
                size="sm"
                aria-label={`Message ${i + 1} kind`}
                value={m.kind}
                onChange={(e) =>
                  commitMessages(
                    messages.map((x, j) =>
                      j === i ? { ...x, kind: e.target.value as SequenceMessageKindName } : x,
                    ),
                  )
                }
              >
                {SEQUENCE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {KIND_LABEL[k]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <input
                ref={(n) => {
                  labelRefs.current[i] = n;
                }}
                className={`${MENU_CELL_INPUT} flex-1`}
                value={m.label}
                placeholder="Message"
                aria-label={`Message ${i + 1} label`}
                maxLength={SEQ_MESSAGE_LABEL_MAX}
                onChange={(e) => setMessage(i, { label: e.target.value })}
                onBlur={() => commitMessages(messages)}
                onKeyDown={(e) => {
                  if (e.key !== 'Enter' || e.nativeEvent.isComposing) return;
                  e.preventDefault();
                  addAfter(i);
                }}
              />
              <RowControls
                index={i}
                count={messages.length}
                min={0}
                noun="message"
                onMove={(to) => commitMessages(move(messages, i, to))}
                onRemove={() => commitMessages(messages.filter((_, j) => j !== i))}
              />
            </div>
          </div>
        ))}
        <button
          type="button"
          disabled={messages.length >= SEQ_MESSAGES_MAX}
          onClick={() => addAfter(messages.length - 1)}
          className={MENU_ADD_ROW_BUTTON}
        >
          Add Message
        </button>
      </div>
      <MenuToggleRow
        label="Numbered"
        checked={target.sequenceNumbered === true}
        onToggle={() =>
          ops.commit((el) => withSequenceNumbered(el, !target.sequenceNumbered), 'SequenceNumbered')
        }
      />
      <div className="px-2 pb-1">
        <BorderGrid label="Animation" cols={4}>
          {([null, 'play'] as const).map((v) => (
            <SizeButton
              key={v ?? 'none'}
              active={play === v}
              label={v ? 'Play Animation' : 'None Animation'}
              onClick={() => handleSet(v)}
            >
              <TileLabel glyph={<PlayIcon on={!!v} />} label={v ? 'Play' : 'None'} />
            </SizeButton>
          ))}
        </BorderGrid>
      </div>
      {showSpeed ? (
        <SpeedAndRepeatRows
          speed={target.sequenceAnimSpeed ?? DEFAULT_ANIMATION_SPEED}
          repeat={target.sequenceAnimRepeat === true}
          onSetSpeed={(speed) =>
            ops.commit((el) => withSequenceAnim(el, { speed }), 'SequenceAnim')
          }
          onSetRepeat={(repeat) =>
            ops.commit((el) => withSequenceAnim(el, { repeat }), 'SequenceAnim')
          }
        />
      ) : null}
    </MenuAccordionSection>
  );
}
