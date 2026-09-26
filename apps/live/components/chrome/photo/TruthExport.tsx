'use client';

import { useEffect, useRef, useState } from 'react';
import type { DetectedSticky } from '@livediagram/sticky-vision';
import { downloadTruth, truthArmed, truthOf } from '@/lib/photo-truth';

// "Save as truth": the corrected review, handed back as a label file
// (docs/research/vision/sticky-detection.md).
//
// The detector is tuned by hand against photographs somebody has labelled note
// by note, and labelling a wall from a blank slate is work nobody finishes.
// The review already asks for exactly that work: untick what is not a note,
// drag a box around what was missed. What is left on screen IS the labelling.
//
// Armed by hand — `?truth=1` on any page of the editor, remembered from then
// on (`TruthArmBoot`) — so an author importing their own wall never meets it.
// Nothing is uploaded: the file goes to this machine's disk, because the labels
// describe somebody's real workshop wall, like the photo does.
//
// The flag is read in an EFFECT rather than during render: these pages are
// prerendered to static HTML, where there is no `localStorage` to ask.
export function TruthExport({
  photoName,
  size,
  notes,
  ticked,
  textOf,
  onOpen,
}: {
  photoName: string;
  size: { width: number; height: number };
  notes: DetectedSticky[];
  ticked: Set<number>;
  // The words on each note as they stand in the review, edits included.
  textOf: (id: number) => string;
  // A saved label file the author picked, to lay over the photo and correct.
  onOpen: (file: File) => void;
}) {
  const picker = useRef<HTMLInputElement | null>(null);
  const [armed, setArmed] = useState(false);
  useEffect(() => setArmed(truthArmed()), []);
  const kept = notes
    .filter((note) => ticked.has(note.id))
    .map((note) => ({ ...note, text: textOf(note.id) }));
  if (!armed) return null;
  const pill =
    'pointer-events-auto rounded-full border border-amber-300/60 bg-amber-950/80 px-3 py-1.5 text-xs font-medium text-amber-100 shadow-lg backdrop-blur hover:bg-amber-900/90';
  return (
    <>
      <button type="button" onClick={() => picker.current?.click()} className={pill}>
        Open label
      </button>
      <input
        ref={picker}
        type="file"
        accept="application/json,.json"
        aria-label="Open a saved label"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Picking the same file twice must still open it.
          e.target.value = '';
          if (file) onOpen(file);
        }}
      />
      <button
        type="button"
        onClick={() => downloadTruth(truthOf(photoName, size, kept))}
        className={pill}
      >
        Save as truth ({kept.length})
      </button>
    </>
  );
}
