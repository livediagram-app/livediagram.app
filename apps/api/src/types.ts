// API-worker type surface. The wire-format DTOs are now defined in
// `@livediagram/api-schema` so the api worker and the live editor
// share the same source of truth (no more parallel type definitions
// drifting between them — see CLAUDE.md's reuse-over-duplication
// rule). This file re-exports the canonical names under the
// historical `*DTO` aliases the worker code already uses, and adds
// the worker-only `Env` binding shape that has nowhere else to live.

export type {
  Diagram as DiagramDTO,
  DiagramSummary,
  TabSummary as TabSummaryDTO,
  TabRecord as TabDTO,
  Folder as FolderDTO,
  ParticipantRecord as ParticipantDTO,
  ParticipantPresence,
  ShareRole,
  ShareLink as ShareLinkDTO,
  ChangeLogKind,
  ChangeLogEntry as ChangeLogEntryDTO,
  ServerMessage,
  ClientMessage,
} from '@livediagram/api-schema';

// Worker bindings injected by Cloudflare at runtime. Not part of the
// wire format — purely a server-side capability handle.
export type Env = {
  DB: D1Database;
  DIAGRAM_ROOM: DurableObjectNamespace;
  // Clerk JWKS URL — when set, the request handler verifies Bearer
  // tokens against it via `src/auth/clerk.ts` and prefers the
  // resulting userId over `X-Owner-Id`. When unset, the worker stays
  // in pure-guest mode (X-Owner-Id only). See spec/04 + spec/11.
  CLERK_JWKS_URL?: string;
};
