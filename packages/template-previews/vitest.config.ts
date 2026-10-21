import { defineProject } from '@livediagram/vitest-config';

// Node is the environment: both tests call TemplatePreview as a plain
// function (it is pure render, no hooks) and read its static markup, so
// no DOM is needed. The JSX in the preview files compiles with the
// automatic runtime, as it does in the apps that render them.
export default defineProject({
  esbuild: { jsx: 'automatic' },
});
