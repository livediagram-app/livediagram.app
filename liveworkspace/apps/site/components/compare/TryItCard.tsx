import type { CompareVoice } from './compare-theme';
import { startHref, startLabel } from './compare-theme';

// The "just try it" card that closes a comparison and the hub: a line of copy and a button into
// each app the comparison is about, in the voice's deep shade. With no apps (the hub), it points at
// the apps on the front door instead.
export function TryItCard({
  title,
  body,
  voice,
  className = '',
}: {
  title: string;
  body: string;
  voice: CompareVoice;
  className?: string;
}) {
  return (
    <div
      className={`relative flex flex-col items-start justify-between overflow-hidden rounded-2xl bg-[var(--lw-ink)] p-6 text-white ${className}`}
    >
      <span
        aria-hidden="true"
        className="absolute inset-0 [background-image:radial-gradient(rgb(255_255_255/0.12)_1px,transparent_1px)] [background-size:14px_14px]"
      />
      <div className="relative">
        <p className="text-xl font-semibold tracking-tight">{title}</p>
        <p className="mt-1 text-sm text-white/85">{body}</p>
      </div>
      <div className="relative mt-5 flex flex-wrap gap-2">
        {voice.apps.length > 0 ? (
          voice.apps.map((app) => (
            <a
              key={app.id}
              href={startHref(app)}
              className="relative touch-target-y inline-flex items-center justify-center rounded-md bg-white px-5 py-2.5 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
            >
              {voice.apps.length > 1 ? `${startLabel(app)} in ${app.name}` : startLabel(app)}
            </a>
          ))
        ) : (
          <a
            href="/#apps"
            className="relative touch-target-y inline-flex items-center justify-center rounded-md bg-white px-5 py-2.5 text-sm font-medium text-slate-900 shadow-sm transition hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            Pick an app
          </a>
        )}
      </div>
    </div>
  );
}
