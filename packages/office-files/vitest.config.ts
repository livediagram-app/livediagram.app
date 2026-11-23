import { defineProject } from '@liveworkspace/vitest-config';

// Node is the environment: the readers and writers are pure, and the zip reader's DecompressionStream is Node's own.
// The PowerPoint writer's tests stay with each product's export (they write a deck built from its own tabs).
export default defineProject({});
