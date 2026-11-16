// The words of Start a Project (liveworkspace/docs/specs/010-site/site.md "Start a Project"), kept apart from the
// components so each line is pinned by a test.
import {
  IndexError,
  kitPassLevel,
  linkLevelOffered,
  type App,
  type Kit,
  type KitRun,
  type Level,
} from '@liveworkspace/index-client';
import { BRAND_APPS } from '@liveworkspace/brand';

export const LEVELS: readonly Level[] = ['edit', 'participate', 'view'];

export const LEVEL_TITLES: Record<Level, string> = {
  edit: 'Editor',
  participate: 'Participant',
  view: 'Viewer',
};

const LEVEL_VERBS: Record<Level, string> = {
  edit: 'edit',
  participate: 'take part in',
  view: 'view',
};

/** An app's name as its logo spells it: "liveplanner". */
export const appName = (app: App): string => `live${BRAND_APPS[app].word}`;

/** The line under the role: what everyone who opens one file may do with the others. */
export const roleLine = (level: Level): string =>
  `Anyone who can open one of these files can ${LEVEL_VERBS[level]} the others.`;

/** What a part whose app lacks the chosen role gets instead, one line each; none when every app offers it. */
export function fallbackLines(kit: Kit, level: Level): string[] {
  return kit.parts
    .filter((part) => !linkLevelOffered(part.app, level))
    .map(
      (part) =>
        `${appName(part.app)} has no ${LEVEL_TITLES[level]} role, so ${part.name} opens to ${
          LEVEL_TITLES[kitPassLevel(part.app, level)]
        }s.`,
    );
}

/** Create's words: the full one, and the phone's, which names how many files. */
export const createLabels = (kit: Kit) => ({
  wide: 'Create Project',
  narrow: `Create ${kit.parts.length} Files`,
});

/** The run's outcome: every part and connection made, some, or no part at all. */
export type RunOutcome = 'ready' | 'partial' | 'none';

export function runOutcome(run: KitRun): RunOutcome {
  if (run.complete) return 'ready';
  return run.parts.some((p) => p.itemId) ? 'partial' : 'none';
}

export const OUTCOME_TITLES: Record<RunOutcome, string> = {
  ready: 'Your project is ready.',
  partial: 'Some of your project couldn’t be made.',
  none: 'Couldn’t start your project.',
};

/** The connections row: while the run works, then what it made. */
export function connectionsLine(
  kit: Kit,
  level: Level,
  run: KitRun | null,
): { text: string; failed: boolean } {
  if (!run) return { text: `Connecting ${kit.parts.length} files…`, failed: false };
  const { made, failed } = run.connections;
  const total = made + failed;
  if (total === 0 && run.parts.filter((p) => p.itemId).length < 2)
    return { text: 'Nothing to connect yet', failed: true };
  if (failed > 0) return { text: `${made} of ${total} connections made`, failed: true };
  const all = run.parts.filter((p) => p.itemId).length;
  const count = all * (all - 1);
  return {
    text: `${count} ${count === 1 ? 'connection' : 'connections'}, ${LEVEL_TITLES[level]}`,
    failed: false,
  };
}

/** Why a run, a retry or a removal was refused, in words. */
export function refusalWords(error: unknown, doing: 'create' | 'remove'): string {
  const code = error instanceof IndexError ? error.code : null;
  if (code === 'sign_in_required') return 'Sign in to create a project.';
  if (code === 'folder_not_found') return 'That project’s folder is gone. Start a new one.';
  if (code === null) return 'Couldn’t reach liveworkspace. Check your connection and try again.';
  return doing === 'create'
    ? 'Couldn’t create your project. Try again in a moment.'
    : 'Couldn’t delete those files. Try again in a moment.';
}
