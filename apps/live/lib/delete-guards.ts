// Two delete guards asked in turn (useSheetDeleteGuard, then useBoardDeleteGuard): a confirm dialog shows one question
// at a time, so the second asks only once the first is answered. Cancelling the first cancels the delete; a guard with
// nothing to ask passes. Both answers' releases run after the elements go.
import type { SheetDeleteGuard } from '@/hooks/sheets/useSheetDeleteGuard';

export function chainDeleteGuards(
  first: SheetDeleteGuard,
  second: SheetDeleteGuard,
): SheetDeleteGuard {
  return (ids) => {
    const a = first(ids);
    if (!a) return second(ids);
    return a.then(async (answer) => {
      if (!answer) return null;
      const b = second(ids);
      if (!b) return answer;
      const more = await b;
      if (!more) return null;
      return {
        release: () => {
          answer.release();
          more.release();
        },
      };
    });
  };
}
