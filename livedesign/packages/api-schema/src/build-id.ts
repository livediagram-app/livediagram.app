// The live build id (docs/specs/016-platform/stale-builds.md): the deploy's commit, baked into the
// editor's static export and given to the api worker in the same deploy run. A running editor that
// hears a different one from the server is a stale build. The token's shape is liveworkspace's
// (@liveworkspace/api-schema/build-id); the header is livedesign's.
export const BUILD_ID_HEADER = 'X-Livedesign-Build';

export { parseBuildId } from '@liveworkspace/api-schema/build-id';
