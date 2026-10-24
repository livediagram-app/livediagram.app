// The Share dialog's status line: who can open the item right now, in one phrase, with a dot that is slate while
// only the owner can get in and emerald once a pass is live or the item sits in a team's library.

export function shareStatusText({
  passes,
  password,
  team,
  word,
}: {
  passes: number;
  password: boolean;
  team: boolean;
  // The item's kind, lower case ("plan").
  word: string;
}): string {
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
}) {
  const open = props.passes > 0 || props.team;
  return (
    <span className="inline-flex items-center gap-2" role="status" data-share-status="">
      <span aria-hidden className="relative flex h-2 w-2">
        {open ? (
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-60 motion-reduce:hidden" />
        ) : null}
        <span
          className={`relative h-2 w-2 rounded-full ${open ? 'bg-emerald-500' : 'bg-slate-400'}`}
        />
      </span>
      {shareStatusText(props)}
    </span>
  );
}
