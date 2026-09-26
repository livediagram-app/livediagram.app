'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { DetectedSticky, Truth } from '@livediagram/sticky-vision';
import { boxesFromLabel } from '@/lib/photo-boxes';

// The boxes on the photograph under review, as the author has corrected them
// (spec/139 Phase 9): what the detector found, moved, resized, re-kinded,
// deleted, plus the ones drawn round missed notes. Which are TICKED, and which
// one is SELECTED for correcting.
//
// What Add lands is `kept` — the boxes as they stand, so a moved box lands
// where it was moved to.
export function useReviewBoxes(detected: DetectedSticky[], detectionKey: unknown) {
  const [boxes, setBoxes] = useState<DetectedSticky[]>(detected);
  // Everything found is ticked: the common case is "add the wall".
  const [ticked, setTicked] = useState<Set<number>>(() => new Set(detected.map((s) => s.id)));
  const [selected, setSelected] = useState<number | null>(null);
  // Drawn boxes count down from -1, clear of the reader's crop ids.
  const drawnId = useRef(-1);

  // The surface mounts before the detector answers; take its boxes as they
  // land. Keyed on the DETECTION, never on a re-render.
  useEffect(() => {
    setBoxes(detected);
    setTicked(new Set(detected.map((s) => s.id)));
    setSelected(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detectionKey]);

  const toggle = useCallback((id: number) => {
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const add = useCallback((box: Omit<DetectedSticky, 'id'>) => {
    const id = drawnId.current;
    drawnId.current -= 1;
    setBoxes((prev) => [...prev, { ...box, id }]);
    setTicked((prev) => new Set(prev).add(id));
  }, []);

  // Replace one box with its corrected self.
  const update = useCallback((id: number, next: DetectedSticky) => {
    setBoxes((prev) => prev.map((b) => (b.id === id ? next : b)));
  }, []);

  const remove = useCallback((id: number) => {
    setBoxes((prev) => prev.filter((b) => b.id !== id));
    setTicked((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    setSelected((s) => (s === id ? null : s));
  }, []);

  // A saved label, laid over the photo in place of the detection. Returns the
  // words it carried, for the review's edited words. Throws, with a sentence
  // for the author, when the file is not a label for this photo.
  const load = useCallback(
    (label: Truth, photoName: string, frame: { width: number; height: number }) => {
      const { boxes: labelled, words } = boxesFromLabel(label, photoName, frame);
      setBoxes(labelled);
      setTicked(new Set(labelled.map((b) => b.id)));
      setSelected(null);
      return words;
    },
    [],
  );

  const kept = boxes.filter((b) => ticked.has(b.id));

  return { boxes, ticked, kept, selected, select: setSelected, toggle, add, update, remove, load };
}
