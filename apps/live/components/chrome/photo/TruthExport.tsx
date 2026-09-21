'use client';

import { useEffect, useState } from 'react';
import type { DetectedSticky } from '@livediagram/sticky-vision';
import { downloadTruth, truthArmed, truthOf } from '@/lib/photo-truth';

// "Save as truth": the corrected review, handed back as a label file
// (docs/vision/sticky-detection.md).
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
}: {
  photoName: string;
  size: { width: number; height: number };
  notes: DetectedSticky[];
  ticked: Set<number>;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => setArmed(truthArmed()), []);
  const kept = notes.filter((note) => ticked.has(note.id));
  if (!armed) return null;
  return (
    <button
      type="button"
      onClick={() => downloadTruth(truthOf(photoName, size, kept))}
      className="pointer-events-auto rounded-full border border-amber-300/60 bg-amber-950/80 px-3 py-1.5 text-xs font-medium text-amber-100 shadow-lg backdrop-blur hover:bg-amber-900/90"
    >
      Save as truth ({kept.length})
    </button>
  );
}
