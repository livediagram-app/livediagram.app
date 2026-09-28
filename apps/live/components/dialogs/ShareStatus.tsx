// The Share dialog's status line (docs/specs/007-editor/live-app.md "Layout, top to bottom"): the
// diagram's exposure in one phrase, with a dot that is slate while only the
// owner can get in and emerald once any pass is live.
export function ShareStatus({ passes, password }: { passes: number; password: boolean }) {
  const open = passes > 0;
  const holders = passes === 1 ? 'the pass' : `one of the ${passes} passes`;
  const text = open
    ? `Shared: anyone holding ${holders} can get in${password ? ', with the password' : ''}.`
    : 'Private: only you can open it.';
  return (
    <span className="inline-flex items-center gap-2" role="status">
      <span aria-hidden className="relative flex h-2 w-2">
        {open ? (
          <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-60" />
        ) : null}
        <span
          className={`relative h-2 w-2 rounded-full ${open ? 'bg-emerald-500' : 'bg-slate-400'}`}
        />
      </span>
      {text}
    </span>
  );
}
