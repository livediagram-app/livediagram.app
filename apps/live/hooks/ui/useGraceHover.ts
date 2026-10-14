import { useEffect, useRef, useState } from 'react';

// How long a hover outlives the pointer leaving, so it can cross a gap or a layer boundary onto the control the hover
// shows (the table's axis triggers wait the same 250 ms).
export const HOVER_GRACE_MS = 250;

/** Which of several parts is hovered, cleared a moment after the pointer leaves. `enter` (from the part or the control
 *  it shows) cancels a pending clear, so moving from a part onto its control keeps the control up. */
export function useGraceHover<T>() {
  const [hovered, setHovered] = useState<T | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => cancel, []);
  return {
    hovered,
    enter: (part: T) => {
      cancel();
      setHovered(part);
    },
    leave: () => {
      cancel();
      timer.current = setTimeout(() => setHovered(null), HOVER_GRACE_MS);
    },
    set: (part: T | null) => {
      cancel();
      setHovered(part);
    },
  };
}
