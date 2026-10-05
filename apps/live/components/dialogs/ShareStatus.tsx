// The Share dialog's status line (docs/specs/007-editor/live-app.md "Layout, top to bottom"): the
// document's exposure in one phrase, with a dot that is slate while only the
// owner can get in, emerald once any pass is live, and pink while it is listed in the public Community
// (docs/specs/025-community/community.md), the widest exposure, which wins.
export function ShareStatus({
  passes,
  password,
  community = false,
}: {
  passes: number;
  password: boolean;
  community?: boolean;
}) {
  const open = passes > 0 || community;
  const holders = passes === 1 ? 'the pass' : `one of the ${passes} passes`;
  const text = community
    ? 'Public: in the Community, where anyone can find it, view it and make a copy.'
    : open
      ? `Shared: anyone holding ${holders} can get in${password ? ', with the password' : ''}.`
      : 'Private: only you can open it.';
  const dot = community ? 'bg-pink-500' : open ? 'bg-emerald-500' : 'bg-slate-400';
  const ping = community ? 'bg-pink-400' : 'bg-emerald-400';
  return (
    <span className="inline-flex items-center gap-2" role="status">
      <span aria-hidden className="relative flex h-2 w-2">
        {open ? (
          <span className={`absolute inset-0 animate-ping rounded-full ${ping} opacity-60`} />
        ) : null}
        <span className={`relative h-2 w-2 rounded-full ${dot}`} />
      </span>
      {text}
    </span>
  );
}
