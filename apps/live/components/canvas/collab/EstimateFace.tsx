// The face of an Estimate card (spec/123): planning poker. Everyone picks
// from the scale, the card says WHO has answered but not what, and one Reveal
// shows every value at once with the spread called out.

import { estimateValues, responseOf, responseStats, type ShapeElement } from '@livediagram/diagram';
import type { Participant } from '@/lib/identity';
import { ParticipantAvatar } from '@/components/primitives/ParticipantAvatar';
import { CollabButton, CollabChip, CollabEmpty, CollabPanel } from './collab-chrome';

// The spread is the reason the ritual exists, so the card computes the one
// derived line rather than leaving the room to scan for it (spec/123).
export function spreadLine(element: ShapeElement): string {
  const stats = responseStats(element.responses);
  if (stats.count === 0) return 'No answers';
  if (stats.distinct.length === 1) return `Unanimous — ${stats.distinct[0]}`;
  if (stats.min !== null && stats.max !== null && stats.numericCount > 1) {
    return `Spread ${stats.min} to ${stats.max}`;
  }
  // A t-shirt round has no numbers to subtract, so it names the answers.
  return `Spread: ${stats.distinct.join(', ')}`;
}

export function EstimateFace({
  element,
  label,
  textColor,
  selfId,
  participants,
  onRespond,
  onSetRevealed,
  onClear,
}: {
  element: ShapeElement;
  label: string;
  textColor: string;
  selfId: string;
  // The room, so an answer can be shown under the person who gave it.
  participants: Participant[];
  // Cast or withdraw my own pick. Absent on a surface that can't write
  // (a view-role visitor, the read-only embed), which renders the chips inert.
  onRespond?: (value: string) => void;
  onSetRevealed?: (revealed: boolean) => void;
  onClear?: () => void;
}) {
  const values = estimateValues(element.estimateScale);
  const responses = element.responses ?? [];
  const mine = responseOf(responses, selfId);
  const revealed = element.responsesRevealed === true;
  // Presence is the denominator: "4 of 6 in" only means something against the
  // people who could still answer.
  const inRoom = Math.max(participants.length, responses.length);
  const named = (participantId: string): Participant | undefined =>
    participants.find((p) => p.id === participantId);

  return (
    <CollabPanel
      element={element}
      title={label.trim() || 'Estimate'}
      textColor={textColor}
      aside={responses.length ? `${responses.length}/${inRoom} answered` : undefined}
      footer={
        <>
          <CollabButton
            tone="loud"
            textColor={textColor}
            onPress={onSetRevealed && !revealed ? () => onSetRevealed(true) : undefined}
            disabled={revealed}
            tooltip={{
              title: 'Reveal every answer',
              description:
                'Shows everyone what everyone picked, at once. You can reveal before the whole room has answered.',
            }}
          >
            {revealed ? 'Revealed' : 'Reveal'}
          </CollabButton>
          <CollabButton
            textColor={textColor}
            onPress={onClear && responses.length > 0 ? onClear : undefined}
            tooltip={{
              title: 'Clear for the next round',
              description: 'Empties every answer and hides the card again.',
            }}
          >
            Clear
          </CollabButton>
        </>
      }
    >
      <div className="flex flex-wrap gap-1.5">
        {values.map((value) => (
          <CollabChip
            key={value}
            value={value}
            mine={mine === value}
            // Pressing your own pick again withdraws it — the same press, so
            // there is no second control to find.
            onPress={onRespond ? () => onRespond(value) : undefined}
            textColor={textColor}
          />
        ))}
      </div>
      {/* Fills the room between the chips and the footer, and centres what it
          holds. Pinned to the top, a round with one or two voters left a band
          of dead space above the buttons; a long round fills it by itself. */}
      <div className="flex min-h-0 flex-1 flex-col justify-center">
        {responses.length === 0 ? (
          <CollabEmpty textColor={textColor}>
            Nobody has picked yet. Your own pick stays hidden from everyone else until Reveal.
          </CollabEmpty>
        ) : revealed ? (
          <div>
            <p
              className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] opacity-70"
              style={{ color: textColor }}
            >
              {spreadLine(element)}
            </p>
            {/* Gaps here have to clear the avatar's presence RING, which is a
                box-shadow and so paints outside the layout box without
                reserving any space: every gap loses 4px per adjacent avatar.
                Hence the between-pair gap of 4 (12px clear) and the
                within-pair gap of 2 (4px clear) — which still reads as
                tighter inside a pair than between them, the thing the
                grouping depends on. */}
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {responses.map((r) => {
                const who = named(r.participantId);
                return (
                  <span key={r.participantId} className="flex items-center gap-2">
                    {who ? <ParticipantAvatar participant={who} size={18} /> : null}
                    <span
                      className="text-[13px] font-semibold tabular-nums"
                      style={{ color: textColor }}
                    >
                      {r.value}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        ) : (
          // Before the reveal: WHO, deliberately not what. Knowing Sam has
          // answered is what stops the wait; knowing Sam said 13 is the thing
          // being prevented (spec/123).
          <div>
            <p
              className="mb-1.5 text-[10px] uppercase tracking-[0.06em] opacity-55"
              style={{ color: textColor }}
            >
              Answered
            </p>
            {/* Avatar to avatar, so BOTH rings eat into the gap: 3 (12px)
                leaves the same 4px clear as a single-ring gap of 2. At the
                old 1.5 the rings overlapped by 2px, which read as a stack
                nobody asked for. */}
            <div className="flex flex-wrap items-center gap-3">
              {responses.map((r) => {
                const who = named(r.participantId);
                return who ? (
                  <ParticipantAvatar key={r.participantId} participant={who} size={22} />
                ) : (
                  <span
                    key={r.participantId}
                    className="inline-block h-[22px] w-[22px] rounded-full bg-black/15 dark:bg-white/20"
                    aria-label="Someone who has since left the room"
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </CollabPanel>
  );
}
