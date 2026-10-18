import { useEffect, useState } from 'react';
import { debugLog } from '@/lib/debug-log';
import { useLatest } from '@/hooks/ui/useLatest';
import { TRY_IT_ADVANCE_MS } from './coach-dock-copy';

// A step's Try it (docs/specs/007-editor/coach-dock.md "A step"): done once the person presses something matching
// `selector` on the page (a layout tile, a background, the +), then `onDone` a beat later so they see it land. A
// press is caught in the capture phase, before a menu's own handler closes what was pressed. A new `stepKey` starts
// over; a step without a Try it passes a null selector and listens to nothing.
export function useTryIt(selector: string | null, stepKey: string, onDone: () => void): boolean {
  const [done, setDone] = useState<{ key: string; done: boolean }>({ key: stepKey, done: false });
  // A new step starts undone. Adjusted during render.
  if (done.key !== stepKey) setDone({ key: stepKey, done: false });
  const isDone = done.key === stepKey && done.done;

  useEffect(() => {
    if (!selector || isDone) return;
    const onPress = (e: MouseEvent) => {
      if (!(e.target instanceof Element) || !e.target.closest(selector)) return;
      debugLog('[coach-dock] try-it', { step: stepKey });
      setDone({ key: stepKey, done: true });
    };
    document.addEventListener('click', onPress, true);
    return () => document.removeEventListener('click', onPress, true);
  }, [selector, stepKey, isDone]);

  const onDoneRef = useLatest(onDone);
  useEffect(() => {
    if (!isDone) return;
    const t = setTimeout(() => onDoneRef.current(), TRY_IT_ADVANCE_MS);
    return () => clearTimeout(t);
  }, [isDone, stepKey, onDoneRef]);

  return isDone;
}
