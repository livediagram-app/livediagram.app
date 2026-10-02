// The live build id (docs/specs/016-platform/stale-builds.md): the deploy's commit, baked into the
// editor's static export and given to the api worker in the same deploy run. A running editor that
// hears a different one from the server is a stale build.
export const BUILD_ID_HEADER = 'X-Livediagram-Build';

const BUILD_ID_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

/** A short token (letters, digits, `.`, `_`, `-`, up to 64), else null. */
export function parseBuildId(value: unknown): string | null {
  return typeof value === 'string' && BUILD_ID_PATTERN.test(value) ? value : null;
}
