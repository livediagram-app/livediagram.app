// The hearing ring's flash (docs/specs/012-collaboration/proximity-audio.md "Your hearing ring"): whenever someone
// comes within earshot, by their walking or yours, the ring shows for a moment, so you see they can hear you. Read
// off the coarse copy of everyone's feet (at most 10 times a second), never every frame.
import { useEffect, useMemo, useRef, useState } from 'react';
import { nextNear, type Point } from './hearing';
import { zoning, type CallZone } from './zones';

const NOBODY: ReadonlySet<string> = new Set();

/**
 * A count that goes up each time someone new comes within earshot: the ring flashes on each change. Nobody counts
 * while you are not walking, and whoever is near when you start walking does not flash it.
 */
export function useEarshotFlash(
  self: Point | null,
  walkers: readonly { id: string; at: Point }[],
  zones: readonly CallZone[],
): number {
  const near = useMemo(() => {
    if (!self) return null;
    return {
      self,
      walkers,
      zoning: zoning(self, new Map(walkers.map((w) => [w.id, w.at])), zones),
    };
  }, [self, walkers, zones]);
  const prev = useRef<ReadonlySet<string> | null>(null);
  const [flash, setFlash] = useState(0);
  useEffect(() => {
    if (!near) {
      prev.current = null;
      return;
    }
    const was = prev.current;
    const next = nextNear(was ?? NOBODY, near.self, near.walkers, near.zoning);
    prev.current = next;
    if (was && next !== was && [...next].some((id) => !was.has(id))) setFlash((n) => n + 1);
  }, [near]);
  return flash;
}
