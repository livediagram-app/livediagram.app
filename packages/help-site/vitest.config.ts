import { defineProject } from '@liveworkspace/vitest-config';

// Node by default: most suites are pure helpers, or guards that read the four help apps from disk. The
// component suites opt into jsdom per file. Next compiles JSX with the automatic runtime, so these do too.
export default defineProject({
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: { dedupe: ['react', 'react-dom'] },
});
