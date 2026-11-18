'use client';

// Which swatch a text colour picker's readability row judges (each product's docs/specs/004-interface-design/
// colour-picker.md "Reading on its ground"): the swatch the pointer or focus last rested on, else (null) the colour
// in force. The row sits under the swatches, so the pointer crosses other swatches on its way from a pale one down to
// Use. A swatch it only crossed (left within SWATCH_REST_MS) gives way, as the pointer reaches the row, to the one it
// rested on before, so Use fixes the colour the person was looking at. Focus moved by a key always rests; the swatches
// focus lands on as the picker opens are not judged (nor previewed) until a key is pressed in it.
import { useRef, useState } from 'react';

// How long the pointer stays on a swatch for it to count as rested on, not crossed: a pointer sweeping across a
// 24px swatch toward the row is on it for a frame or two (about 16 to 60 ms); one being looked at, far longer.
export const SWATCH_REST_MS = 150;

const clock = () => performance.now();

export type JudgedSwatch = {
  // The swatch judged, or null for the colour in force.
  judged: string | null;
  // A key pressed in the picker: focus judges and previews from now on.
  keyed: () => void;
  // The mouse on a swatch.
  hover: (id: string) => void;
  // Focus on a swatch: whether it counts (a key moved it), so the picker previews it too.
  focus: (id: string) => boolean;
  // The mouse reaching the row: when the swatch judged was only crossed on the way, the one rested on before, which
  // the picker previews in its place (null: the colour in force); undefined when nothing changes.
  arrive: () => { id: string | null } | undefined;
  // The pointer or focus leaving the picker.
  end: () => void;
};

/** The judged swatch for a picker with a readability row; with `on` false (no row) it never re-renders on hover. */
export function useJudgedSwatch(on: boolean, now: () => number = clock): JudgedSwatch {
  const [judged, setJudged] = useState<string | null>(null);
  const keyedRef = useRef(false);
  // The swatch the pointer last rested on, and the one it is on now with when it arrived.
  const rested = useRef<string | null>(null);
  const entered = useRef<{ id: string; at: number } | null>(null);
  const judge = (id: string | null) => {
    if (on) setJudged(id);
  };
  return {
    judged: on ? judged : null,
    keyed: () => {
      keyedRef.current = true;
    },
    hover: (id) => {
      const at = now();
      const was = entered.current;
      if (was && at - was.at >= SWATCH_REST_MS) rested.current = was.id;
      entered.current = { id, at };
      judge(id);
    },
    focus: (id) => {
      if (!keyedRef.current) return false;
      rested.current = id;
      entered.current = null;
      judge(id);
      return true;
    },
    arrive: () => {
      const was = entered.current;
      entered.current = null;
      if (!was) return undefined;
      if (now() - was.at >= SWATCH_REST_MS) {
        rested.current = was.id;
        return undefined;
      }
      judge(rested.current);
      return { id: rested.current };
    },
    end: () => {
      rested.current = null;
      entered.current = null;
      judge(null);
    },
  };
}
