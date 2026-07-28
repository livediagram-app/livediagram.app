'use client';

// Read-only rendering of a rich-text note (spec/92). One component for every
// place a note is shown without being edited: the read-only popover body for
// view-role participants, and the annotation hover preview (spec/38).
//
// Runs are painted as React elements, never as HTML — there is no
// dangerouslySetInnerHTML anywhere on this path, so a note that arrived from
// the API, an import, or another collaborator can't inject markup. The only
// value that leaves the text layer is a link address, and that is re-checked
// against the safe-scheme allowlist before it reaches an href.

import { runsFromPlainText, type TextRun } from '@livediagram/diagram';
import { noteRunHref, noteRunStyle, NOTE_BASE_PX } from './note-run-style';

// Split runs into lines at '\n', keeping each line's runs intact. A note is
// a flat run list (lists are literal "• " prefix text, see rich-text.ts), so
// lines are purely a rendering concern.
export function runsToLines(runs: TextRun[]): TextRun[][] {
  const lines: TextRun[][] = [[]];
  for (const run of runs) {
    const parts = run.text.split('\n');
    parts.forEach((part, i) => {
      if (i > 0) lines.push([]);
      if (part) lines[lines.length - 1]!.push({ ...run, text: part });
    });
  }
  return lines;
}

/**
 * Resolve what to render for an element: its formatted runs when it has
 * them, otherwise its plain `note` as a single unformatted run. Keeps every
 * pre-spec/92 note rendering exactly as it did.
 */
export function noteRuns(note: string | undefined, noteRich: TextRun[] | undefined): TextRun[] {
  return noteRich && noteRich.length > 0 ? noteRich : runsFromPlainText(note ?? '');
}

export function NoteRichText({
  note,
  noteRich,
  className = '',
}: {
  note: string | undefined;
  noteRich: TextRun[] | undefined;
  className?: string;
}) {
  const lines = runsToLines(noteRuns(note, noteRich));
  return (
    <div
      data-note-surface=""
      className={`break-words ${className}`}
      style={{ fontSize: `${NOTE_BASE_PX}px` }}
    >
      {lines.map((line, i) => (
        // An empty line still needs to occupy a row, hence the zero-width
        // space fallback (an empty <div> collapses to nothing).
        <div key={i} className="leading-snug">
          {line.length === 0 ? '​' : line.map((run, j) => <NoteRun key={j} run={run} />)}
        </div>
      ))}
    </div>
  );
}

function NoteRun({ run }: { run: TextRun }) {
  const href = noteRunHref(run);
  const style = noteRunStyle(run);
  if (!href) return <span style={style}>{run.text}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      style={style}
      // The hover preview is pointer-events-none as a whole; in the popover
      // the anchor is clickable. Stop the click reaching the canvas either
      // way so following a link never doubles as a canvas gesture.
      onClick={(e) => e.stopPropagation()}
      className="pointer-events-auto hover:opacity-80"
    >
      {run.text}
    </a>
  );
}
