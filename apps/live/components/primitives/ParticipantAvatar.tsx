import {
  initialsOf,
  participantAccessibleName,
  statusLabel,
  statusRingColor,
  type Participant,
} from '@/lib/identity';
import { relativeSince, useRelativeNow } from '@/lib/relative-time';
import { HoverCard } from '@livediagram/ui';
import { PictureDisc } from '@/components/primitives/PictureDisc';
import { IDENTITY_FILL, identityVars } from '@/lib/identity-fill';

// How far the presence ring paints BEYOND the avatar's layout box, per side.
//
// It is drawn as a box-shadow, which reserves no space, so an avatar is
// visually this much wider than the `size` you asked for. Any flex gap next to
// one loses this much on that side: a `gap-1` beside an avatar renders as zero
// clearance, which is exactly how the Estimate card ended up with a vote value
// touching the ring. Rule of thumb: a gap between an avatar and text wants
// 8px+, and between two avatars 12px+.
export const AVATAR_RING_OVERHANG_PX = 4;

type ParticipantAvatarProps = {
  participant: Participant;
  // Diameter of the avatar circle in px (the status ring sits outside it —
  // see AVATAR_RING_OVERHANG_PX before laying one out beside text).
  size?: number;
  // When true, wrap in a HoverCard with the participant's name + status.
  withHoverCard?: boolean;
  // Small chip pinned next to the name in the hover card title. Optional,
  // multiple allowed. Callers pass strings like "You" (own avatar) or
  // "Viewer" / "Editor" (when the role is known). Renders as a pill so
  // it's visually distinct from the bare name — matches the in-canvas
  // role badge style at the top of the document.
  badges?: string[];
};

// Round avatar showing the participant's initials over their assigned
// colour, framed by a coloured "presence" ring (green / orange / red).
// Used in the editor header today; will appear next to comments and
// inside the collab cursor stack later.
export function ParticipantAvatar({
  participant,
  size = 28,
  withHoverCard = false,
  badges,
}: ParticipantAvatarProps) {
  // Subscribe the avatar's hover card to the 30s relative-time tick so
  // an opened hover card's "Active 2 mins ago" refreshes itself instead
  // of going stale. The hook is cheap so we always pay it — calling
  // it conditionally would violate rules-of-hooks if `withHoverCard`
  // flipped.
  const now = useRelativeNow();
  const ringColor = statusRingColor(participant.status);
  // The ring is drawn as a 2px box-shadow with a 1px white gap inside.
  const avatar = (
    <PictureDisc
      as="div"
      pictureUrl={participant.picture}
      size={size}
      role="img"
      aria-label={participantAccessibleName(participant)}
      style={{
        ...identityVars(participant.color),
        fontSize: Math.round(size * 0.4),
        boxShadow: `0 0 0 2px white, 0 0 0 ${AVATAR_RING_OVERHANG_PX}px ${ringColor}`,
      }}
      className={`font-semibold text-white ${IDENTITY_FILL}`}
    >
      {initialsOf(participant.name)}
    </PictureDisc>
  );
  if (!withHoverCard) return avatar;
  // HoverCard description: status + idle duration. Surfaces both at
  // once because the status word (Away / Offline) alone hides the
  // useful number ("Away 8 mins ago" reads very differently from
  // "Away 6 hours ago"). When `lastActiveAt` is omitted (legacy
  // call site that doesn't track it), fall back to the bare status
  // label so the hover card still says something sensible.
  const idleSuffix =
    participant.lastActiveAt !== undefined
      ? ` · Active ${relativeSince(participant.lastActiveAt, now)}`
      : '';
  // An agent's status line leads (docs/specs/024-agents/blueprints/agent-presence.md "Presentation and UX"): an
  // agent row says only what it is doing, an owner's row says it before their own status.
  const description = participant.agent
    ? (participant.statusLine ?? statusLabel(participant.status))
    : `${participant.statusLine ? `${participant.statusLine} · ` : ''}${statusLabel(participant.status)}${idleSuffix}`;
  const title =
    badges && badges.length > 0 ? (
      <span className="flex flex-wrap items-center gap-1">
        <span>{participant.name}</span>
        {badges.map((b) => (
          <span
            key={b}
            className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300"
          >
            {b}
          </span>
        ))}
      </span>
    ) : (
      participant.name
    );
  return (
    <HoverCard title={title} description={description}>
      {avatar}
    </HoverCard>
  );
}
