// The room's cards (docs/specs/012-collaboration/estimate-card.md "The two states"). Before the reveal, one
// face-down card per person who has answered, their avatar on it, and a slim
// "4 of 6 in" bar: who, deliberately not what. After it, every card face up,
// sorted low to high in a short flip cascade, the spread called out, and the
// lowest and highest cards ringed, because they are who should talk first.

import {
  estimateRank,
  estimateSpread,
  estimateSpreadLabel,
  type EstimateScale,
  type ParticipantResponse,
} from '@livediagram/diagram';
import { participantKey, type Participant } from '@/lib/identity';
import { ParticipantAvatar } from '@/components/primitives/ParticipantAvatar';
import { tint } from '../collab-chrome';
import { QA_ACCENT, QA_ACCENT_INK, QA_ON_ACCENT } from '../qa/qa-parts';

export function EstimateTable({
  scale,
  responses,
  revealed,
  inRoom,
  participants,
  textColor,
}: {
  scale: EstimateScale | undefined;
  responses: ParticipantResponse[];
  revealed: boolean;
  // Presence is the denominator: "4 of 6 in" only means something against
  // the people who could still answer.
  inRoom: number;
  participants: Participant[];
  textColor: string;
}) {
  // Answers are recorded under the document-write key, not the presence id
  // (see participantKey); matching on `p.id` found nobody but ourselves.
  const named = (key: string) => participants.find((p) => participantKey(p) === key);

  if (!revealed) {
    const share = inRoom > 0 ? responses.length / inRoom : 0;
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="flex flex-wrap justify-center gap-2">
          {responses.map((r) => (
            <Card key={r.participantId} who={named(r.participantId)} textColor={textColor}>
              {null}
            </Card>
          ))}
        </div>
        <div className="flex w-full max-w-[220px] flex-col gap-1">
          <span
            className="text-center text-[10.5px] font-semibold"
            style={{ color: textColor, opacity: 0.7 }}
          >
            {responses.length} of {inRoom} in
          </span>
          <span
            className="h-1.5 overflow-hidden rounded-full"
            style={{ backgroundColor: tint(textColor, 0.08) }}
          >
            <span
              className="est-progress block h-full rounded-full"
              style={{ width: `${Math.round(share * 100)}%`, backgroundColor: QA_ACCENT }}
            />
          </span>
        </div>
      </div>
    );
  }

  const spread = estimateSpread(
    scale,
    responses.map((r) => r.value),
  );
  const sorted = [...responses].sort(
    (a, b) => estimateRank(scale, a.value) - estimateRank(scale, b.value),
  );
  const unanimous = spread.kind === 'unanimous';
  return (
    <div className="flex flex-col items-center gap-3">
      <span
        className="rounded-full px-2.5 py-1 text-[10.5px] font-bold"
        style={
          unanimous
            ? { color: QA_ACCENT_INK, backgroundColor: tint(QA_ACCENT, 0.16) }
            : { color: textColor, backgroundColor: tint(textColor, 0.08) }
        }
      >
        {estimateSpreadLabel(spread)}
      </span>
      <div className="flex flex-wrap justify-center gap-2">
        {sorted.map((r, i) => {
          const end =
            spread.kind === 'range' && (r.value === spread.low || r.value === spread.high);
          return (
            <Card
              key={r.participantId}
              who={named(r.participantId)}
              textColor={textColor}
              faceUp
              ringed={end}
              filled={unanimous}
              delay={i * 60}
            >
              {r.value}
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// One person's card: face down (a tint of the accent) or face up (its value),
// with their avatar hanging off the bottom edge.
function Card({
  who,
  textColor,
  faceUp,
  ringed,
  filled,
  delay = 0,
  children,
}: {
  who: Participant | undefined;
  textColor: string;
  faceUp?: boolean;
  ringed?: boolean;
  filled?: boolean;
  delay?: number;
  children: React.ReactNode;
}) {
  return (
    <span className="relative flex flex-col items-center pb-2">
      <span
        className={`flex h-[46px] w-[34px] items-center justify-center rounded-lg border text-[15px] font-bold tabular-nums ${faceUp ? 'est-flip' : 'qa-enter'}`}
        style={{
          animationDelay: faceUp ? `${delay}ms` : undefined,
          color: filled ? QA_ON_ACCENT : textColor,
          backgroundColor: filled
            ? QA_ACCENT
            : faceUp
              ? tint(textColor, 0.05)
              : tint(QA_ACCENT, 0.18),
          borderColor: ringed ? QA_ACCENT : faceUp ? tint(textColor, 0.16) : tint(QA_ACCENT, 0.4),
          boxShadow: ringed ? `0 0 0 2px ${tint(QA_ACCENT, 0.35)}` : undefined,
        }}
      >
        {faceUp ? <span className="text-optical-centre">{children}</span> : null}
      </span>
      <span className="absolute bottom-0">
        {who ? (
          <ParticipantAvatar participant={who} size={16} />
        ) : (
          <span
            className="block h-4 w-4 rounded-full"
            style={{ backgroundColor: tint(textColor, 0.2) }}
            aria-label="Someone who has since left the room"
          />
        )}
      </span>
    </span>
  );
}
