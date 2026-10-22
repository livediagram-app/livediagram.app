// The Share dialog's status line (docs/specs/007-editor/live-app.md "Layout, top to bottom"): the
// document's exposure in one phrase, with a dot that is slate while only the
// owner can get in, and emerald once any pass is live or it sits in a team library.
export function ShareStatus({
  passes,
  password,
  team = false,
}: {
  passes: number;
  password: boolean;
  // In a team library: every member can open it, so it is never "only you" (docs/specs/013-workspace/
  // team-shared-documents.md).
  team?: boolean;
}) {
  const open = passes > 0 || team;
  const holders = passes === 1 ? 'the pass' : `one of the ${passes} passes`;
  const withPassword = password ? ', with the password' : '';
  const text = team
    ? passes > 0
      ? `Shared: every member of the team can open it, and anyone holding ${holders} can get in${withPassword}.`
      : 'Team: every member of the team can open it.'
    : open
      ? `Shared: anyone holding ${holders} can get in${withPassword}.`
      : 'Private: only you can open it.';
  const dot = open ? 'bg-emerald-500' : 'bg-slate-400';
  return (
    <span className="inline-flex items-center gap-2" role="status">
      <span aria-hidden className="relative flex h-2 w-2">
        {open ? (
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-60" />
        ) : null}
        <span className={`relative h-2 w-2 rounded-full ${dot}`} />
      </span>
      {text}
    </span>
  );
}
