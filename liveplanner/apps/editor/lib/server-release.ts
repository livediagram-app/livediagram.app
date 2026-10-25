// What this page has heard of the server's release (docs/specs/016-platform/new-version-prompt.md,
// docs/specs/016-platform/stale-builds.md): the project format number and the live build id. Fed by
// every api response's headers (apiFetch) and the realtime room's `format` message; read by the new
// version prompt and the stale build navigation. Module state: one page, one server.
import { PROJECT_FORMAT, parseBuildId, parseProjectFormat } from '@liveplanner/api-schema';
import { createListeners } from '@liveworkspace/workbench/lib/listeners';

/** The build id this editor was built with; null when the build set none (local development). */
export const EDITOR_BUILD_ID: string | null = parseBuildId(process.env.NEXT_PUBLIC_BUILD_ID);

let highestFormat: number | null = null;
let latestBuild: string | null = null;
const listeners = createListeners();

const notify = () => {
  listeners.notify();
};

/** Records a format number from the server; anything unparsable is ignored, and only a rise notifies. */
export function noteServerProjectFormat(value: unknown): void {
  const format = parseProjectFormat(value);
  if (format === null || (highestFormat !== null && format <= highestFormat)) return;
  highestFormat = format;
  notify();
}

/** Records the server's live build id; anything unparsable is ignored, and only a change notifies. */
export function noteServerBuild(value: unknown): void {
  const build = parseBuildId(value);
  if (build === null || build === latestBuild) return;
  latestBuild = build;
  notify();
}

export function serverProjectFormat(): number | null {
  return highestFormat;
}

export function serverBuild(): string | null {
  return latestBuild;
}

/** The server serves a project format newer than this editor was built for. */
export function newVersionAvailable(): boolean {
  return highestFormat !== null && highestFormat > PROJECT_FORMAT;
}

/** Stale: both build ids are known and differ. */
export function isStaleBuild(editor: string | null, server: string | null): boolean {
  return editor !== null && server !== null && editor !== server;
}

/** This page runs an older (or other) build than the one now live. */
export function runningStaleBuild(): boolean {
  return isStaleBuild(EDITOR_BUILD_ID, latestBuild);
}

export const subscribeServerRelease = listeners.subscribe;

export function resetServerReleaseForTests(): void {
  highestFormat = null;
  latestBuild = null;
  listeners.clear();
}
