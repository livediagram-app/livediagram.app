'use client';

// What the surface is doing, said ON the photograph (spec/139 Phase 9).
//
// Pills rather than a panel: the photo is the whole interface, and a strip of
// chrome beside it would be the sidebar coming back through the window. They
// float in a fixed row at the top of the frame, so one appearing or going
// never moves anything else.

function Pill({
  tone = 'quiet',
  testId,
  children,
}: {
  tone?: 'quiet' | 'warn';
  testId?: string;
  children: React.ReactNode;
}) {
  return (
    <p
      data-testid={testId}
      className={`pointer-events-auto flex max-w-[min(32rem,80vw)] items-center gap-2 rounded-full px-3 py-1.5 text-xs shadow-lg backdrop-blur ${
        tone === 'warn' ? 'bg-amber-100/95 text-amber-900' : 'bg-slate-900/85 text-white'
      }`}
    >
      {children}
    </p>
  );
}

export function PhotoStatus({
  detecting,
  foundNothing,
  dropped = 0,
  revealed,
  detected,
  reading,
  readError,
}: {
  detecting: boolean;
  foundNothing: boolean;
  // Notes found beyond what one photo may yield, and left out.
  dropped?: number;
  revealed: number;
  detected: number;
  reading: boolean;
  readError: string | null;
}) {
  return (
    <div
      aria-live="polite"
      className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center gap-2 p-3"
    >
      {detecting ? (
        <Pill testId="photo-finding">
          <span
            aria-hidden
            className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-slate-500 border-t-brand-400"
          />
          Finding the stickies…
        </Pill>
      ) : null}
      {revealed < detected ? (
        <Pill>
          Detecting… {revealed} of {detected}
        </Pill>
      ) : null}
      {reading ? (
        <Pill>
          <span
            aria-hidden
            className="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-slate-500 border-t-brand-400"
          />
          Reading the words…
        </Pill>
      ) : null}
      {readError?.startsWith('partial:') ? (
        // PART of the run is not all of it. The words that arrived are on their
        // notes; this says how many did not, so the author knows which boxes
        // are blank because nobody read them rather than because the paper was
        // blank.
        <Pill tone="warn">
          {readError.slice('partial:'.length)} notes could not be read. Type those in yourself.
        </Pill>
      ) : readError ? (
        <Pill tone="warn">
          The reader could not finish ({readError}). Type the words in yourself.
        </Pill>
      ) : null}
      {dropped > 0 ? (
        <Pill tone="warn" testId="photo-dropped">
          {dropped} more notes were found than one photo can bring in. Photograph the wall in
          sections to get them all.
        </Pill>
      ) : null}
      {foundNothing ? (
        <Pill tone="warn" testId="photo-found-nothing">
          No stickies found in this photo. Fill the frame with the wall, shoot straight on, and give
          it good light — then try another photo. You can still drag a box around a note to add it
          by hand.
        </Pill>
      ) : null}
    </div>
  );
}
