// The Workers a `dev:*` script runs in one process (./start.mjs). Each keeps the port its own `dev` script gives it
// (AGENTS.md's port blocks). The gateway takes a free port in the group's block and the inspector port the first
// Worker had alone. Only liveworkspace's services so far: a product's router, api and MCP saved 0.2 to 0.3 GB steady
// this way (measured 2026-11-23), too little for the folded configs a product's `--env local` router would need.

export const GROUPS = {
  workspace: {
    root: 'liveworkspace',
    gatewayPort: 3009,
    inspectorPort: 9130,
    workers: [
      'liveworkspace/apps/accounts',
      'liveworkspace/apps/telemetry',
      'liveworkspace/apps/community',
      'liveworkspace/apps/media',
      'liveworkspace/apps/index',
      'liveworkspace/apps/subscription',
      'liveworkspace/apps/status',
      'liveworkspace/apps/drive',
    ],
  },
};
