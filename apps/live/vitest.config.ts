import { defineProject } from '@livediagram/vitest-config';

// Node environment is enough for the current pure-logic tests (canvas
// geometry). When component / hook tests land, switch to 'jsdom' and add
// jsdom + @testing-library/react. See specs/18-testing.md.
export default defineProject();
