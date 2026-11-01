import { defineProject } from '@liveworkspace/vitest-config';

// The image reference index's extractor is held at 100%, as each product's api holds its own image-refs code: a gap
// here deletes a picture someone placed (each product's docs/specs/009-elements/images.md "Reference index"). The D1
// compound helpers are held there too: every service's test database leans on the guard to stand in for production.
// So is the request-failure guard: every Worker that owns storage answers its throws through it. And the room's element
// gate: every product's room judges an Editor's element ops through it before relaying them.
export default defineProject({
  test: {
    coverage: {
      thresholds: {
        'src/agent-presence-stamps.ts': {
          statements: 100,
          branches: 100,
          functions: 100,
          lines: 100,
        },
        'src/image-refs.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/d1-compound.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/d1-compound-guard.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/request-failure.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
        'src/room-element-ops.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
      },
    },
  },
});
