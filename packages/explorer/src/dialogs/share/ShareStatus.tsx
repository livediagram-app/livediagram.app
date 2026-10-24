// The Share dialog's status line: who can open the item right now, in one phrase, with a dot that is slate while
// only the owner can get in, emerald once a pass is live or the item sits in a team's library, and pink while the
// host says it is public (livediagram's canvas listed in the Community), the widest exposure, which wins.

export function shareStatusText({
  passes,
  password,
  team,
  word,
  publicNote = null,
}: {
  passes: number;
  password: boolean;
  team: boolean;
  // The item's kind, lower case ("plan").
  word: string;
  // Where the item is public, in the host's words ("in the Community, where anyone can find it, ..."); null when
  // it is not.
  publicNote?: string | null;
}): string {
  if (publicNote) return `Public: ${publicNote}`;
  const holders = passes === 1 ? 'the pass' : `one of the ${passes} passes`;
  const withPassword = password ? ', with the password' : '';
  if (team) {
    return passes > 0
      ? `Shared: every member of the team can open this ${word}, and anyone holding ${holders} can get in${withPassword}.`
      : `Team: every member of the team can open this ${word}.`;
  }
  return passes > 0
    ? `Shared: anyone holding ${holders} can get in${withPassword}.`
    : `Private: only you can open this ${word}.`;
}

export function ShareStatus(props: {
  passes: number;
  password: boolean;
  team: boolean;
  word: string;
  publicNote?: string | null;
}) {
  const isPublic = Boolean(props.publicNote);
  const open = props.passes > 0 || props.team || isPublic;
  const dot = isPublic ? 'bg-pink-500' : open ? 'bg-emerald-500' : 'bg-slate-400';
  const ping = isPublic ? 'bg-pink-400' : 'bg-emerald-400';
  return (
    <span
      className="inline-flex items-center gap-2"
      role="status"
      data-share-status={isPublic ? 'public' : ''}
    >
      <span aria-hidden className="relative flex h-2 w-2">
        {open ? (
          <span
            className={`absolute inset-0 animate-ping rounded-full ${ping} opacity-60 motion-reduce:hidden`}
          />
        ) : null}
        <span className={`relative h-2 w-2 rounded-full ${dot}`} />
      </span>
      {shareStatusText(props)}
    </span>
  );
}
