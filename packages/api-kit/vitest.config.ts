import { defineProject } from '@liveworkspace/vitest-config';

// The image reference index's extractor is held at 100%, as each product's api holds its own image-refs code: a gap
// here deletes a picture someone placed (each product's docs/specs/009-elements/images.md "Reference index").
export default defineProject({
  test: {
    coverage: {
      thresholds: {
        'src/image-refs.ts': { statements: 100, branches: 100, functions: 100, lines: 100 },
      },
    },
  },
});
