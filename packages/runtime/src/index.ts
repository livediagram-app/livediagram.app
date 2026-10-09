// The runtime seam (docs/specs/016-platform/self-hosted-runtime.md): everything
// the application needs from its platform, and nothing about which platform it
// is. `apps/api/src/runtime/cloudflare.ts` answers it from Worker bindings;
// the Node runtime answers it from the process.
export type { Db, DbMeta, DbResult, DbStatement } from './db';
export type {
  ObjectHttpMetadata,
  ObjectPutOptions,
  ObjectPutValue,
  ObjectStore,
  StoredObject,
} from './objects';
export type { Limiter, LimiterName, LimiterResult, Limiters } from './limiters';
export type { Scheduler } from './scheduler';
export type {
  HtmlHandlers,
  HtmlTransformer,
  HtmlTransformerFactory,
  IdentityConfig,
  RoomHandle,
  RoomHost,
  Runtime,
} from './runtime';
