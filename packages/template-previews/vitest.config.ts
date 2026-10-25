import { defineProject } from '@liveworkspace/vitest-config';

// Node is the environment: the tests here read the stylesheets and render previews to static markup,
// so no DOM is needed. The JSX compiles with the automatic runtime, as it does in the apps that render
// the previews.
export default defineProject({
  oxc: { jsx: { runtime: 'automatic' } },
});
