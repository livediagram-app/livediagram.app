import { defineProject } from '@liveworkspace/vitest-config';

// The templates' own card types, as the paths that make a template's tabs provide them (src/test-setup.ts).
export default defineProject({ test: { setupFiles: ['./src/test-setup.ts'] } });
