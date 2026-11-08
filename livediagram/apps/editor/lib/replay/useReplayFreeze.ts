import { useMemo } from 'react';
import { debugLog } from '@liveworkspace/workbench/lib/debug-log';
import { isReplayActive } from './replay-store';

type Writers<C, T, U, R> = { commit: C; tick: T; undo: U; redo: R };

// Watch It Built's write freeze (docs/specs/007-editor/blueprints/watch-it-built.md "The freeze"): the history's
// writers, made to drop what they are given while a replay runs. Stable while the writers are.
export function useReplayFreeze<
  C extends (...args: never[]) => void,
  T extends (...args: never[]) => void,
  U extends (...args: never[]) => void,
  R extends (...args: never[]) => void,
>(writers: Writers<C, T, U, R>): Writers<C, T, U, R> {
  const { commit, tick, undo, redo } = writers;
  return useMemo(
    () => ({
      commit: frozen('commit', commit),
      tick: frozen('tick', tick),
      undo: frozen('undo', undo),
      redo: frozen('redo', redo),
    }),
    [commit, tick, undo, redo],
  );
}

export function frozen<F extends (...args: never[]) => void>(name: string, write: F): F {
  return ((...args: Parameters<F>) => {
    if (isReplayActive()) {
      debugLog(`[replay] dropped a document ${name} while Watch It Built runs`);
      return;
    }
    write(...args);
  }) as F;
}
