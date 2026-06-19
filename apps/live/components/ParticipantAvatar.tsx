import { initialsOf, statusLabel, statusRingColor, type Participant } from '@/lib/identity';
import { relativeSince, useRelativeTimeTick } from '@/lib/relative-time';
import { Tooltip } from './Tooltip';

type ParticipantAvatarProps = {
  participant: Participant;
  // Diameter of the avatar circle in px (the status ring sits outside it).
  size?: number;
  // When true, wrap in a Tooltip with the participant's name + status.
  withTooltip?: boolean;
  // Small chip pinned next to the name in the tooltip title. Optional,
  // multiple allowed. Callers pass strings like "You" (own avatar) or
  // "Viewer" / "Editor" (when the role is known). Renders as a pill so
  // it's visually distinct from the bare name — matches the in-canvas
  // role badge style at the top of the diagram.
  badges?: string[];
};

// Round avatar showing the participant's initials over their assigned
// colour, framed by a coloured "presence" ring (green / orange / red).
// Used in the editor header today; will appear next to comments and
// inside the collab cursor stack later.
export function ParticipantAvatar({
  participant,
  size = 28,
  withTooltip = false,
  badges,
}: ParticipantAvatarProps) {
  // Subscribe the avatar's tooltip to the 30s relative-time tick so
  // an opened tooltip's "Active 2 mins ago" refreshes itself instead
  // of going stale. The hook is cheap so we always pay it — calling
  // it conditionally would violate rules-of-hooks if `withTooltip`
  // flipped.
  useRelativeTimeTick();
  const ringColor = statusRingColor(participant.status);
  // The ring is drawn as a 2px box-shadow with a 1px white gap inside.
  const avatar = (
    <div
      role="img"
      aria-label={`${participant.name} (${statusLabel(participant.status)})`}
      style={{
        width: size,
        height: size,
        backgroundColor: participant.color,
        boxShadow: `0 0 0 2px white, 0 0 0 4px ${ringColor}`,
      }}
      className="flex items-center justify-center rounded-full text-xs font-semibold text-white select-none"
    >
      <span style={{ fontSize: Math.round(size * 0.4) }}>{initialsOf(participant.name)}</span>
    </div>
  );
  if (!withTooltip) return avatar;
  // Tooltip description: status + idle duration. Surfaces both at
  // once because the status word (Away / Offline) alone hides the
  // useful number ("Away 8 mins ago" reads very differently from
  // "Away 6 hours ago"). When `lastActiveAt` is omitted (legacy
  // call site that doesn't track it), fall back to the bare status
  // label so the tooltip still says something sensible.
  const idleSuffix =
    participant.lastActiveAt !== undefined
      ? ` · Active ${relativeSince(participant.lastActiveAt)}`
      : '';
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
    <Tooltip title={title} description={`${statusLabel(participant.status)}${idleSuffix}`}>
      {avatar}
    </Tooltip>
  );
}
