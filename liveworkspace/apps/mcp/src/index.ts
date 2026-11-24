// liveworkspace's one MCP (liveworkspace/docs/specs/021-mcp/mcp.md): the Worker entry. mcp-kit serves the transport,
// CORS, the server card and OAuth; one-mcp.ts routes each request; app-workers.ts runs every app's MCP package in
// this Worker ("The app MCPs fold in").
import { packageRequest, routerEnv } from './app-workers';
import type { Env, WorkerEnv } from './env';
import { oneMcp } from './one-mcp';

export type { Env, WorkerEnv };

export default oneMcp<WorkerEnv>(routerEnv, packageRequest) satisfies ExportedHandler<WorkerEnv>;
