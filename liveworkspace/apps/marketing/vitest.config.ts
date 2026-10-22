import { defineProject } from '@livediagram/vitest-config';

// Next compiles JSX with the automatic runtime, so tests that render a component do too.
export default defineProject({ oxc: { jsx: { runtime: 'automatic' } } });
