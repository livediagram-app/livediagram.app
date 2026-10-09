import config from '@livediagram/eslint-config';

// The shared config ignores the build output every app has (dist, .next, out).
// These three are the self-hosted stack's own runtime state
// (docs/specs/016-platform/blueprints/self-hosted-runtime.md, "Delivery"): the
// SQLite files, the object store and the static export ./data-static mounts.
// Nothing above knows those names, so lint walked 37 MB of Next.js output and
// 19 637 errors came out of it. Ignored here rather than in the shared config:
// no other package has a reason to own a directory called `data`.
export default [{ ignores: ['data/**', 'data-*/**'] }, ...config];
