'use client';

// A shown tab with nothing to draw yet: on its way, failed (with Retry), or truly empty.
export function TabWaiting({
  name,
  status,
  onRetry,
}: {
  name: string;
  status: 'loaded' | 'failed' | 'loading';
  onRetry: () => void;
}) {
  if (status === 'failed')
    return (
      <div
        role="alert"
        className="flex items-center gap-2 p-4 text-[13px] text-slate-500 dark:text-slate-400"
      >
        Couldn’t load {name}.
        <button
          type="button"
          onClick={onRetry}
          className="cursor-pointer rounded-md px-1.5 py-0.5 font-medium text-brand-700 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10"
        >
          Retry
        </button>
      </div>
    );
  return (
    <p aria-live="polite" className="p-4 text-[13px] text-slate-500 dark:text-slate-400">
      {status === 'loading' ? `Loading ${name}…` : `Nothing on ${name} yet.`}
    </p>
  );
}
