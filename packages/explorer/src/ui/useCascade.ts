'use client';

import { useEffect, useState } from 'react';

// How long a list keeps its cascade class after it first paints: the cascade's last row is done by then.
const CASCADE_MS = 300;

/** The list's rows cascade in when it first shows (and again for a new list, `key`); rows scrolled into view
 *  later, or mounted by the window as it moves, arrive as they are. */
export function useCascade(key: string): boolean {
  const [on, setOn] = useState(true);
  useEffect(() => {
    setOn(true);
    const t = setTimeout(() => setOn(false), CASCADE_MS);
    return () => clearTimeout(t);
  }, [key]);
  return on;
}
