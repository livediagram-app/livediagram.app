import { defineProject } from '@livediagram/vitest-config';

// Node stays the default environment: these suites are documentation-correctness
// checks (the registry, article links, repo paths in docs), not rendering.
//
// `jsx: 'automatic'` is needed anyway, because two of those checks reach into
// .tsx modules for their DATA: the feature-icon and article-icon maps are
// records of JSX elements. Next compiles JSX with the automatic runtime (no
// React import in scope), so a .tsx module transformed any other way here
// throws "React is not defined" at import time — the same override apps/live
// carries, for the same reason.
export default defineProject({ esbuild: { jsx: 'automatic' } });
