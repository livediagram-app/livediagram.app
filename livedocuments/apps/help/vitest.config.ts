import { fileURLToPath } from 'node:url';
import { defineProject } from '@liveworkspace/vitest-config';

// Node stays the default environment: most of these suites are documentation-correctness
// checks (the registry, article links, repo paths in docs), not rendering.
//
// `jsx: 'automatic'` is needed anyway, because two of those checks reach into
// .tsx modules for their DATA: the feature-icon and article-icon maps are
// records of JSX elements. Next compiles JSX with the automatic runtime (no
// React import in scope), so a .tsx module transformed any other way here
// throws "React is not defined" at import time — the same override apps/editor
// carries, for the same reason.
//
// The alias mirrors tsconfig's `"@/*": ["./*"]`, so a suite can import the modules the pages use (the category
// scenes, the home page's sections) as the pages do.
export default defineProject({
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: { alias: { '@': fileURLToPath(new URL('.', import.meta.url)) } },
});
